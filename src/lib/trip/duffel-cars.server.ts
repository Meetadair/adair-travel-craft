/**
 * Server-only Duffel Cars access: quote a rate, book it, cancel it.
 *
 * Mirrors duffel-stays.server.ts on purpose — same base URL, same key, same
 * duffel-<status> error mapping, and the same three-step flow Duffel's own
 * Cars guide documents: search (already done in duffel.server.ts), quote the
 * chosen rate, then book the quote. Cars is a product an account requests
 * access to separately from Air and Stays, and its full field-level
 * reference sits behind that request — the paths and fields below follow
 * Duffel's documented flow and its consistent naming elsewhere in this API
 * (/stays/quotes, /stays/bookings become /cars/quotes, /cars/bookings), but
 * are unconfirmed against a live response. isProductDisabled treats a 404 as
 * "not enabled" for exactly that reason: a wrong path degrades to the same
 * honest "requested" line as a genuinely disabled product, never a broken
 * booking or a silent invention of a confirmation.
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
 * True when the failure means "this account cannot sell cars", not "this
 * booking failed". Callers keep the car as a requested line in that case, so
 * the traveller sees the rental on the trip and nothing is charged for it.
 * A 404 counts too, since the quote/booking paths are inferred rather than
 * confirmed — see the file header.
 */
export function isProductDisabled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message === "missing-key" ||
    message === "duffel-401" ||
    message === "duffel-403" ||
    message === "duffel-404"
  );
}

/* -------------------------------- quote -------------------------------- */

export type CarQuote = {
  quoteId: string;
  totalAmount: number;
  currency: string;
};

/**
 * Turns a searched rate into a bookable quote. The quote — not the search
 * result — carries the price we are allowed to charge, so the caller compares
 * the two and reports a reprice rather than quietly booking a different total.
 */
export async function quoteCarRate(rateId: string): Promise<CarQuote> {
  const json = await call<{
    data?: { id: string; total_amount?: string; total_currency?: string };
  }>("/cars/quotes", {
    method: "POST",
    body: JSON.stringify({ data: { rate_id: rateId } }),
  });

  const quote = json.data;
  if (!quote) throw new Error("quote-gone");
  return {
    quoteId: quote.id,
    totalAmount: Number(quote.total_amount ?? 0),
    currency: quote.total_currency ?? "EUR",
  };
}

/* ------------------------------- booking ------------------------------- */

export type CarBookingResult = {
  id: string;
  bookingReference: string | null;
  totalAmount: number;
  currency: string;
};

export async function createCarBooking(input: {
  quoteId: string;
  amount: number;
  currency: string;
  /** The person picking up the car. */
  driver: {
    givenName: string;
    familyName: string;
    bornOn: string;
    email: string;
    phone: string;
  };
  idempotencyKey: string;
  /**
   * Customer card payment via Duffel's hosted form and its 3-D Secure
   * session. Without one the Duffel balance pays, exactly as for flights and
   * stays — some rates only guarantee or postpay at the counter, but until
   * that distinction is confirmed against a live quote response this always
   * offers a payment the same way the other two products do.
   */
  cardPayment?: { threeDSecureSessionId: string } | null;
}): Promise<CarBookingResult> {
  const json = await call<{
    data?: {
      id: string;
      reference?: string;
      booking_reference?: string;
      total_amount?: string;
      total_currency?: string;
    };
  }>("/cars/bookings", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      data: {
        quote_id: input.quoteId,
        driver: {
          given_name: input.driver.givenName,
          family_name: input.driver.familyName,
          born_on: input.driver.bornOn,
          email: input.driver.email,
          phone_number: input.driver.phone,
        },
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
  if (!booking) throw new Error("car-booking-failed");
  return {
    id: booking.id,
    bookingReference: booking.reference ?? booking.booking_reference ?? null,
    totalAmount: Number(booking.total_amount ?? input.amount),
    currency: booking.total_currency ?? input.currency,
  };
}

export async function cancelCarBooking(bookingId: string): Promise<{ status: string }> {
  const json = await call<{ data?: { status?: string; cancelled_at?: string } }>(
    `/cars/bookings/${bookingId}/actions/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
  const data = json.data;
  if (!data) throw new Error("car-cancel-failed");
  return {
    status: data.cancelled_at || data.status === "cancelled" ? "cancelled" : "cancel-requested",
  };
}

/* ---------------------------- book in one step -------------------------- */

export type BookCarOutcome =
  | {
      status: "confirmed";
      booking: CarBookingResult;
      quote: CarQuote;
      /** Set when the quote priced differently from the search result. */
      repriced: { from: number; to: number } | null;
    }
  /** The account cannot sell cars yet: keep the line as requested, charge nothing. */
  | { status: "not-enabled" }
  /** A real failure on a live product: the car line fails, the trip is partial. */
  | { status: "failed"; reason: string };

function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "quote-gone" || message === "duffel-422") return "rate-expired";
  if (message === "duffel-429") return "rate-limited";
  return "supplier-error";
}

/**
 * Quote, compare, book — and say plainly which of the three outcomes
 * happened. The caller decides what a line looks like; this keeps the
 * supplier rules (what counts as "not enabled", what counts as an expired
 * rate) in one place, exactly as bookStay does for Stays.
 */
export async function bookCar(input: {
  rateId: string;
  /** What the traveller saw at search time, in the rate's currency. */
  expectedAmount: number;
  driver: {
    givenName: string;
    familyName: string;
    bornOn: string;
    email: string;
    phone: string;
  };
  idempotencyKey: string;
  cardPayment?: { threeDSecureSessionId: string } | null;
}): Promise<BookCarOutcome> {
  let quote: CarQuote;
  try {
    quote = await quoteCarRate(input.rateId);
  } catch (error) {
    if (isProductDisabled(error)) return { status: "not-enabled" };
    return { status: "failed", reason: reasonOf(error) };
  }

  const repriced =
    Math.abs(quote.totalAmount - input.expectedAmount) > 0.01
      ? { from: input.expectedAmount, to: quote.totalAmount }
      : null;

  try {
    const booking = await createCarBooking({
      quoteId: quote.quoteId,
      amount: quote.totalAmount,
      currency: quote.currency,
      driver: input.driver,
      idempotencyKey: input.idempotencyKey,
      cardPayment: input.cardPayment ?? null,
    });
    return { status: "confirmed", booking, quote, repriced };
  } catch (error) {
    // A product that answered the quote cannot be "disabled" at the booking
    // step; a failure here is real and is reported as one.
    return { status: "failed", reason: reasonOf(error) };
  }
}
