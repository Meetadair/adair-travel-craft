/**
 * Server-only Duffel order handling (test mode).
 * Reprices an offer before booking and creates the order with balance payment.
 */
import {
  bagLabel,
  buildSeatMap,
  customerPriceEur,
  type AncillaryOption,
  type AncillarySelection,
  type RawSeatMapCabin,
  type SeatMapRow,
} from "./ancillaries";

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

export type OfferSnapshot = {
  id: string;
  totalAmount: number;
  currency: string;
  expiresAt: string | null;
  passengerIds: string[];
};

export async function getOffer(offerId: string): Promise<OfferSnapshot> {
  const json = await call<{
    data?: {
      id: string;
      total_amount: string;
      total_currency: string;
      expires_at?: string;
      passengers?: Array<{ id: string }>;
    };
  }>(`/air/offers/${offerId}?return_available_services=false`, { method: "GET" });

  const offer = json.data;
  if (!offer) throw new Error("offer-gone");
  return {
    id: offer.id,
    totalAmount: Number(offer.total_amount),
    currency: offer.total_currency,
    expiresAt: offer.expires_at ?? null,
    passengerIds: (offer.passengers ?? []).map((p) => p.id),
  };
}

/**
 * The airline's own extras for this fare: checked bags from the offer's
 * available services, seats from the seat map when one is published. Returns
 * an empty list when the fare carries nothing — never a made-up option.
 */
export async function getOfferAncillaries(
  offerId: string,
  rule: { markupBps: number; discountBps: number },
): Promise<{ options: AncillaryOption[]; seatMapPublished: boolean; seatMaps: SeatMapRow[][] }> {
  const options: AncillaryOption[] = [];

  const offer = await call<{
    data?: {
      total_currency?: string;
      available_services?: Array<{
        id: string;
        type: string;
        total_amount: string;
        total_currency: string;
        maximum_quantity?: number;
        metadata?: { maximum_weight_kg?: number | null; maximum_depth_cm?: number | null };
      }>;
    };
  }>(`/air/offers/${offerId}?return_available_services=true`, { method: "GET" });

  for (const service of offer.data?.available_services ?? []) {
    if (service.type !== "baggage") continue;
    const netEur = Number(service.total_amount);
    if (!Number.isFinite(netEur)) continue;
    const weight = service.metadata?.maximum_weight_kg ?? null;
    options.push({
      id: service.id,
      kind: "bag",
      label: bagLabel(weight),
      detail: null,
      netEur,
      priceEur: customerPriceEur(netEur, rule),
      currency: service.total_currency,
      maxQuantity: Math.max(1, service.maximum_quantity ?? 1),
      bag: { weightKg: weight },
    });
  }

  let seatMapPublished = false;
  const seatMaps: SeatMapRow[][] = [];
  try {
    const maps = await call<{ data?: Array<{ cabins?: RawSeatMapCabin[] }> }>(
      `/air/seat_maps?offer_id=${encodeURIComponent(offerId)}`,
      { method: "GET" },
    );

    // One entry per flight segment (outbound, return, each leg of a
    // connection) — kept separate so the grid never mixes two aircraft's
    // seats into one confusing cross-section.
    for (const map of maps.data ?? []) {
      const built = buildSeatMap(map.cabins ?? [], rule);
      if (built.rows.length === 0) continue;
      seatMapPublished = true;
      options.push(...built.options);
      seatMaps.push(built.rows);
    }
  } catch (error) {
    // Many fares publish no seat map at all; that is not a booking failure.
    console.error("seat map unavailable", error);
  }

  return { options, seatMapPublished, seatMaps };
}

/**
 * An identity document as the airline needs it. A bare number is useless:
 * Duffel wants the issuing country and the expiry alongside it, and airlines
 * on routes leaving the travel area refuse the order without all three.
 */
export type PassportDetails = {
  number: string;
  /** ISO 3166-1 alpha-2, e.g. "PL". */
  countryCode: string;
  /** "YYYY-MM-DD". */
  expiresOn: string;
  /**
   * What the number is. Inside Schengen most people travel on an identity card
   * and many own no passport at all, so Adair stores either — but an identity
   * card must never be handed to an airline as a passport, which is a document
   * mismatch the traveller only discovers at the gate.
   */
  documentType?: "passport" | "national_id";
};

function identityDocuments(passport: PassportDetails | null | undefined) {
  if (!passport?.number?.trim()) return {};
  // Only a passport goes to the airline. An identity card is kept for the
  // traveller and for hotel check-in; sending it as a passport would be a lie
  // the gate catches, not us.
  if (passport.documentType === "national_id") return {};
  return {
    identity_documents: [
      {
        type: "passport",
        unique_identifier: passport.number.trim(),
        issuing_country_code: passport.countryCode.trim().toUpperCase(),
        expires_on: passport.expiresOn,
      },
    ],
  };
}

export type OrderResult = {
  id: string;
  bookingReference: string | null;
  totalAmount: number;
  currency: string;
  documents: Array<{ type: string; unique_identifier?: string }>;
};

export async function createFlightOrder(input: {
  offerId: string;
  amount: number;
  currency: string;
  passengerIds: string[];
  traveller: {
    givenName: string;
    familyName: string;
    email: string;
    phone: string;
    bornOn: string;
    gender: "m" | "f";
    title: "mr" | "ms" | "mrs";
    passport?: PassportDetails | null | undefined;
  };
  /**
   * Everyone else on the booking, in seat order. Each gets their own name and
   * date of birth; the lead traveller's contact details are used throughout,
   * because that is who we can actually reach.
   */
  companions?: Array<{
    givenName: string;
    familyName: string;
    bornOn: string;
    gender: "m" | "f";
    title: "mr" | "ms" | "mrs";
    passport?: PassportDetails | null | undefined;
    /** The travel_companions row this person was pre-filled from, if any. */
    travellerId?: string | null;
  }>;
  idempotencyKey: string;
  /**
   * Customer card payment. When present the airline is paid with the card the
   * traveller entered in Duffel's hosted form (via its 3-D Secure session);
   * otherwise the Duffel balance is used.
   */
  cardPayment?: { threeDSecureSessionId: string } | null;
  /** Bags and seats the customer chose, as supplier service ids. */
  services?: AncillarySelection[];
  /**
   * What those services cost at the airline, in the offer's own currency. Duffel
   * requires the payment to equal the offer plus its services; leaving this out
   * while sending services is how a booking with a bag was always refused.
   */
  servicesAmount?: number;
  /**
   * Frequent-flyer accounts the supplier accepts on the order, grouped by
   * whose they are — the map key is a travel_companions id, or null for the
   * lead traveller (passenger 0). A companion with no matching key gets none.
   */
  loyaltyAccountsByTraveller?: Map<
    string | null,
    Array<{ airlineIataCode: string; accountNumber: string }>
  >;
}): Promise<OrderResult> {
  const json = await call<{
    data?: {
      id: string;
      booking_reference?: string;
      total_amount?: string;
      total_currency?: string;
      documents?: Array<{ type: string; unique_identifier?: string }>;
    };
  }>("/air/orders", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [input.offerId],
        ...(input.services?.length
          ? {
              services: input.services.map((s) => ({ id: s.id, quantity: s.quantity })),
            }
          : {}),
        payments: [
          (() => {
            const payable = (
              Math.round((input.amount + (input.servicesAmount ?? 0)) * 100) / 100
            ).toFixed(2);
            return input.cardPayment
              ? {
                  type: "card",
                  amount: payable,
                  currency: input.currency,
                  three_d_secure_session_id: input.cardPayment.threeDSecureSessionId,
                }
              : { type: "balance", amount: payable, currency: input.currency };
          })(),
        ],
        passengers: input.passengerIds.map((id, index) => {
          const companion = index === 0 ? null : ((input.companions ?? [])[index - 1] ?? null);
          const person = companion ?? input.traveller;
          // Passenger 0 is always the account holder (travellerId null); a
          // companion carries their own id only when the form was pre-filled
          // from their saved traveller profile.
          const travellerId = index === 0 ? null : (companion?.travellerId ?? null);
          const accounts = input.loyaltyAccountsByTraveller?.get(travellerId) ?? [];
          return {
            id,
            given_name: person.givenName,
            family_name: person.familyName,
            born_on: person.bornOn,
            gender: person.gender,
            title: person.title,
            email: input.traveller.email,
            phone_number: input.traveller.phone,
            ...identityDocuments(person.passport),
            ...(accounts.length
              ? {
                  loyalty_programme_accounts: accounts.map((a) => ({
                    airline_iata_code: a.airlineIataCode,
                    account_number: a.accountNumber,
                  })),
                }
              : {}),
          };
        }),
      },
    }),
  });

  const order = json.data;
  if (!order) throw new Error("order-failed");
  return {
    id: order.id,
    bookingReference: order.booking_reference ?? null,
    totalAmount: Number(order.total_amount ?? input.amount),
    currency: order.total_currency ?? input.currency,
    documents: order.documents ?? [],
  };
}

export async function cancelFlightOrder(orderId: string): Promise<{ status: string }> {
  const created = await call<{ data?: { id: string } }>("/air/order_cancellations", {
    method: "POST",
    body: JSON.stringify({ data: { order_id: orderId } }),
  });
  const id = created.data?.id;
  if (!id) throw new Error("cancel-failed");
  const confirmed = await call<{ data?: { confirmed_at?: string } }>(
    `/air/order_cancellations/${id}/actions/confirm`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return { status: confirmed.data?.confirmed_at ? "cancelled" : "pending" };
}
