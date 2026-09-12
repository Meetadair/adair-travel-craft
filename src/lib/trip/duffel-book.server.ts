/**
 * Server-only Duffel order handling (test mode).
 * Reprices an offer before booking and creates the order with balance payment.
 */
import {
  bagLabel,
  customerPriceEur,
  seatLabel,
  type AncillaryOption,
  type AncillarySelection,
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
): Promise<{ options: AncillaryOption[]; seatMapPublished: boolean }> {
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
  try {
    const maps = await call<{
      data?: Array<{
        cabins?: Array<{
          rows?: Array<{
            sections?: Array<{
              elements?: Array<{
                type?: string;
                designator?: string;
                disclosures?: string[];
                available_services?: Array<{
                  id: string;
                  total_amount: string;
                  total_currency: string;
                }>;
              }>;
            }>;
          }>;
        }>;
      }>;
    }>(`/air/seat_maps?offer_id=${encodeURIComponent(offerId)}`, { method: "GET" });

    const seen = new Set<string>();
    for (const map of maps.data ?? []) {
      for (const cabin of map.cabins ?? []) {
        for (const row of cabin.rows ?? []) {
          for (const section of row.sections ?? []) {
            const elements = section.elements ?? [];
            const seats = elements.filter((e) => e.type === "seat");
            seats.forEach((element, indexInSection) => {
              seatMapPublished = true;
              const service = element.available_services?.[0];
              if (!service) return;
              const netEur = Number(service.total_amount);
              if (!Number.isFinite(netEur)) return;
              const disclosures = (element.disclosures ?? []).join(" ").toLowerCase();
              const position =
                indexInSection === 0
                  ? "window"
                  : indexInSection === seats.length - 1
                    ? "aisle"
                    : "middle";
              const id = service.id;
              if (seen.has(id)) return;
              seen.add(id);
              options.push({
                id,
                kind: "seat",
                label: seatLabel(element.designator ?? null),
                detail: null,
                netEur,
                priceEur: customerPriceEur(netEur, rule),
                currency: service.total_currency,
                maxQuantity: 1,
                seat: {
                  position,
                  extraLegroom:
                    disclosures.includes("legroom") || disclosures.includes("extra space"),
                },
              });
            });
          }
        }
      }
    }
  } catch (error) {
    // Many fares publish no seat map at all; that is not a booking failure.
    console.error("seat map unavailable", error);
  }

  return { options, seatMapPublished };
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
    passportNumber?: string | null | undefined;
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
  /** Frequent-flyer accounts the supplier accepts on the order. */
  loyaltyAccounts?: Array<{ airlineIataCode: string; accountNumber: string }>;
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
          input.cardPayment
            ? {
                type: "card",
                amount: input.amount.toFixed(2),
                currency: input.currency,
                three_d_secure_session_id: input.cardPayment.threeDSecureSessionId,
              }
            : { type: "balance", amount: input.amount.toFixed(2), currency: input.currency },
        ],
        passengers: input.passengerIds.map((id, index) => {
          const person =
            index === 0 ? input.traveller : (input.companions ?? [])[index - 1] ?? input.traveller;
          return {
          id,
          given_name: person.givenName,
          family_name: person.familyName,
          born_on: person.bornOn,
          gender: person.gender,
          title: person.title,
          email: input.traveller.email,
          phone_number: input.traveller.phone,
          ...(index === 0 && input.loyaltyAccounts?.length
            ? {
                loyalty_programme_accounts: input.loyaltyAccounts.map((a) => ({
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
