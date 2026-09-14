/**
 * Server-only Duffel Stays access: quote a rate, book it, cancel it.
 *
 * Mirrors `duffel-book.server.ts` (flights) on purpose — same base URL, same
 * key, same `duffel-<status>` error mapping — so the two booking paths fail and
 * log the same way. Stays are not enabled on every Duffel account: a 401/403
 * means the product is switched off rather than that the booking went wrong,
 * and `isProductDisabled` below is what lets the caller tell those apart and
 * degrade instead of charging or failing a trip.
 */

const BASE = "https://api.duffel.com";

function key(): string {
  const value = process.env["DUFFEL_API_KEY"];
  if (!value) throw new Error("missing-key");
  return value;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Duffel ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`duffel-${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * True when the failure means "this account cannot sell stays", not "this
 * booking failed". Callers keep the stay as a requested line in that case, so
 * the traveller sees the hotel on the trip and nothing is charged for it.
 */
export function isProductDisabled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message === "missing-key" || message === "duffel-401" || message === "duffel-403";
}

/** Until when, and for how much, the stay can still be cancelled. */
export type CancellationWindow = {
  /** ISO timestamp the refund applies before. */
  before: string;
  refundAmount: number;
  currency: string;
};

type RawTimeline = Array<{
  before?: string;
  refund_amount?: string;
  currency?: string;
}>;

function timelineOf(raw: RawTimeline | undefined): CancellationWindow[] {
  return (raw ?? [])
    .filter((entry): entry is { before: string } & typeof entry => Boolean(entry.before))
    .map((entry) => ({
      before: entry.before,
      refundAmount: Number(entry.refund_amount ?? 0),
      currency: entry.currency ?? "EUR",
    }));
}

/** The last moment the stay is still fully refundable, when the hotel states one. */
export function freeCancellationUntil(timeline: CancellationWindow[]): string | null {
  const free = timeline
    .filter((w) => w.refundAmount > 0)
    .sort((a, b) => Date.parse(b.before) - Date.parse(a.before))[0];
  return free?.before ?? null;
}

/* -------------------------------- quote -------------------------------- */

export type StayQuote = {
  quoteId: string;
  totalAmount: number;
  currency: string;
  expiresAt: string | null;
  checkIn: string | null;
  checkOut: string | null;
  cancellationTimeline: CancellationWindow[];
};

/**
 * Turns a searched rate into a bookable quote. The quote — not the search
 * result — carries the price we are allowed to charge, so the caller compares
 * the two and reports a reprice rather than quietly booking a different total.
 */
export async function quoteRate(rateId: string): Promise<StayQuote> {
  const json = await call<{
    data?: {
      id: string;
      total_amount?: string;
      total_currency?: string;
      expires_at?: string;
      check_in_date?: string;
      check_out_date?: string;
      cancellation_timeline?: RawTimeline;
    };
  }>("/stays/quotes", {
    method: "POST",
    body: JSON.stringify({ data: { rate_id: rateId } }),
  });

  const quote = json.data;
  if (!quote) throw new Error("quote-gone");
  return {
    quoteId: quote.id,
    totalAmount: Number(quote.total_amount ?? 0),
    currency: quote.total_currency ?? "EUR",
    expiresAt: quote.expires_at ?? null,
    checkIn: quote.check_in_date ?? null,
    checkOut: quote.check_out_date ?? null,
    cancellationTimeline: timelineOf(quote.cancellation_timeline),
  };
}

/* ------------------------------- booking ------------------------------- */

export type StayBookingResult = {
  id: string;
  bookingReference: string | null;
  totalAmount: number;
  currency: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  cancellationTimeline: CancellationWindow[];
};

export async function createStayBooking(input: {
  quoteId: string;
  amount: number;
  currency: string;
  /** Everyone sleeping in the room, lead guest first. */
  guests: Array<{ givenName: string; familyName: string }>;
  email: string;
  phone: string;
  /** Free text the hotel may or may not honour; never a promise to the guest. */
  accommodationSpecialRequests?: string | null;
  /** Hotel programme number, when the traveller holds one this chain earns on. */
  loyaltyProgrammeAccountNumber?: string | null;
  idempotencyKey: string;
  /**
   * Customer card payment via Duffel's hosted form and its 3-D Secure session.
   * Without one the Duffel balance pays the hotel, exactly as for flights.
   */
  cardPayment?: { threeDSecureSessionId: string } | null;
}): Promise<StayBookingResult> {
  const json = await call<{
    data?: {
      id: string;
      reference?: string;
      booking_reference?: string;
      status?: string;
      total_amount?: string;
      total_currency?: string;
      check_in_date?: string;
      check_out_date?: string;
      cancellation_timeline?: RawTimeline;
    };
  }>("/stays/bookings", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      data: {
        quote_id: input.quoteId,
        guests: input.guests.map((guest) => ({
          given_name: guest.givenName,
          family_name: guest.familyName,
        })),
        email: input.email,
        phone_number: input.phone,
        ...(input.accommodationSpecialRequests
          ? { accommodation_special_requests: input.accommodationSpecialRequests }
          : {}),
        ...(input.loyaltyProgrammeAccountNumber
          ? { loyalty_programme_account_number: input.loyaltyProgrammeAccountNumber }
          : {}),
        payment: input.cardPayment
          ? {
              type: "card",
              amount: input.amount.toFixed(2),
              currency: input.currency,
              three_d_secure_session_id: input.cardPayment.threeDSecureSessionId,
            }
          : { type: "balance", amount: input.amount.toFixed(2), currency: input.currency },
      },
    }),
  });

  const booking = json.data;
  if (!booking) throw new Error("stay-booking-failed");
  return {
    id: booking.id,
    // Duffel has used both spellings across versions; take whichever came back
    // rather than showing the traveller a trip with no hotel reference.
    bookingReference: booking.reference ?? booking.booking_reference ?? null,
    totalAmount: Number(booking.total_amount ?? input.amount),
    currency: booking.total_currency ?? input.currency,
    checkIn: booking.check_in_date ?? null,
    checkOut: booking.check_out_date ?? null,
    status: booking.status ?? null,
    cancellationTimeline: timelineOf(booking.cancellation_timeline),
  };
}

/* ------------------------------ cancel/read ----------------------------- */

export async function cancelStayBooking(bookingId: string): Promise<{ status: string }> {
  const json = await call<{ data?: { status?: string; cancelled_at?: string } }>(
    `/stays/bookings/${bookingId}/actions/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
  const data = json.data;
  if (!data) throw new Error("stay-cancel-failed");
  return {
    status: data.cancelled_at || data.status === "cancelled" ? "cancelled" : "cancel-requested",
  };
}

export async function getStayBooking(bookingId: string): Promise<StayBookingResult> {
  const json = await call<{
    data?: {
      id: string;
      reference?: string;
      booking_reference?: string;
      status?: string;
      total_amount?: string;
      total_currency?: string;
      check_in_date?: string;
      check_out_date?: string;
      cancellation_timeline?: RawTimeline;
    };
  }>(`/stays/bookings/${bookingId}`, { method: "GET" });

  const booking = json.data;
  if (!booking) throw new Error("stay-booking-not-found");
  return {
    id: booking.id,
    bookingReference: booking.reference ?? booking.booking_reference ?? null,
    totalAmount: Number(booking.total_amount ?? 0),
    currency: booking.total_currency ?? "EUR",
    checkIn: booking.check_in_date ?? null,
    checkOut: booking.check_out_date ?? null,
    status: booking.status ?? null,
    cancellationTimeline: timelineOf(booking.cancellation_timeline),
  };
}

/* ---------------------------- book in one step -------------------------- */

export type BookStayOutcome =
  | {
      status: "confirmed";
      booking: StayBookingResult;
      quote: StayQuote;
      /** Set when the quote priced differently from the search result. */
      repriced: { from: number; to: number } | null;
      loyaltySent: boolean;
    }
  /** The account cannot sell stays yet: keep the line as requested, charge nothing. */
  | { status: "not-enabled" }
  /** A real failure on a live product: the stay line fails, the trip is partial. */
  | { status: "failed"; reason: string };

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "quote-gone" || message === "duffel-422" || message === "duffel-404") {
    return "rate-expired";
  }
  if (message === "duffel-429") return "rate-limited";
  return "supplier-error";
}

/**
 * Quote, compare, book — and say plainly which of the three outcomes happened.
 * The caller decides what a line looks like; this keeps the supplier rules
 * (what counts as "not enabled", what counts as an expired rate) in one place.
 */
export async function bookStay(input: {
  rateId: string;
  /** What the traveller saw at search time, in the rate's currency. */
  expectedAmount: number;
  guests: Array<{ givenName: string; familyName: string }>;
  email: string;
  phone: string;
  accommodationSpecialRequests?: string | null;
  loyaltyProgrammeAccountNumber?: string | null;
  idempotencyKey: string;
  cardPayment?: { threeDSecureSessionId: string } | null;
}): Promise<BookStayOutcome> {
  let quote: StayQuote;
  try {
    quote = await quoteRate(input.rateId);
  } catch (error) {
    if (isProductDisabled(error)) return { status: "not-enabled" };
    return { status: "failed", reason: reasonOf(error) };
  }

  const repriced =
    Math.abs(quote.totalAmount - input.expectedAmount) > 0.01
      ? { from: input.expectedAmount, to: quote.totalAmount }
      : null;

  try {
    const booking = await createStayBooking({
      quoteId: quote.quoteId,
      amount: quote.totalAmount,
      currency: quote.currency,
      guests: input.guests,
      email: input.email,
      phone: input.phone,
      accommodationSpecialRequests: input.accommodationSpecialRequests ?? null,
      loyaltyProgrammeAccountNumber: input.loyaltyProgrammeAccountNumber ?? null,
      idempotencyKey: input.idempotencyKey,
      cardPayment: input.cardPayment ?? null,
    });
    return {
      status: "confirmed",
      booking,
      quote,
      repriced,
      loyaltySent: Boolean(input.loyaltyProgrammeAccountNumber),
    };
  } catch (error) {
    // A product that answered the quote cannot be "disabled" at the booking
    // step; a 401/403 here is a real failure and is reported as one.
    return { status: "failed", reason: reasonOf(error) };
  }
}
