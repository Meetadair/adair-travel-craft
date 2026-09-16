/**
 * Test-mode booking: reprice the held offer, create the supplier order,
 * store the trip with its line items, and allow cancelling a line.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chargeableTotalEur } from "@/lib/trip/booked-total";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TripSearchResponse, TripStop } from "@/lib/trip/types";
import { CITIES } from "@/lib/trip/cities";
import { paymentKey, shouldStopBeforeSupplier } from "@/lib/trip/idempotency";
import { tripCalendarEvents, type CalendarEvent, type ItemCalendarPayload } from "@/lib/calendar";
import {
  INSURANCE_AVAILABLE,
  INSURANCE_NOTE,
  INSURANCE_TITLE,
  type InsuranceQuote,
} from "@/lib/trip/insurance";

/**
 * All three parts or none. Duffel refuses an identity document that is just a
 * number, and airlines on routes leaving the travel area refuse the order.
 */
const passportSchema = z
  .object({
    number: z.string().trim().min(4).max(40),
    countryCode: z.string().trim().length(2),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .nullable()
  .optional();

const travellerSchema = z.object({
  givenName: z.string().trim().min(1).max(60),
  familyName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(25),
  bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "ms", "mrs"]),
  passport: passportSchema,
});

const bookSchema = z.object({
  cardId: z.string().uuid(),
  include: z.object({
    flight: z.boolean(),
    stay: z.boolean(),
    car: z.boolean(),
    insurance: z.boolean().optional(),
    /** Optional airport transfers, by leg. */
    rides: z
      .array(z.enum(["arrival", "departure"]))
      .max(2)
      .optional(),
  }),
  companyId: z.string().uuid().nullable(),
  traveller: travellerSchema,
  /** Everyone else on the booking, in seat order after the lead traveller. */
  companions: z
    .array(
      z.object({
        givenName: z.string().trim().min(1).max(60),
        familyName: z.string().trim().min(1).max(60),
        bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        gender: z.enum(["m", "f"]),
        title: z.enum(["mr", "ms", "mrs"]),
        passport: passportSchema,
        /** Save this person to "people I travel with" for next time. */
        remember: z.boolean().optional(),
        /**
         * The travel_companions row this form was pre-filled from, if any —
         * so this person's own loyalty cards (not the lead traveller's) are
         * sent to the airline for them.
         */
        travellerId: z.string().uuid().nullable().optional(),
      }),
    )
    .max(8)
    .optional(),
  /** Airline extras the customer chose: supplier service ids and quantities. */
  ancillaries: z
    .array(
      z.object({ id: z.string().trim().min(3).max(120), quantity: z.number().int().min(1).max(9) }),
    )
    .max(12)
    .optional(),
  /**
   * Result of the hosted card step. Only provider tokens — never card data.
   */
  payment: z
    .object({
      providerCardId: z.string().trim().min(3).max(120),
      threeDSecureSessionId: z.string().trim().max(120),
      brand: z.string().trim().max(40).nullable(),
      last4: z
        .string()
        .trim()
        .regex(/^\d{4}$/)
        .nullable(),
      method: z.enum(["card", "saved-card"]),
    })
    .nullable()
    .optional(),
});

export type BookingResult = {
  tripId: string | null;
  status: "confirmed" | "partial" | "failed";
  reference: string | null;
  totalEur: number;
  lines: Array<{
    kind: string;
    title: string;
    status: string;
    amountEur: number;
    reference: string | null;
    note: string | null;
    payload?: ItemCalendarPayload;
    /** Supplier-side id for this line, when the supplier issued one. */
    supplierOrderId?: string | null;
    /** What the supplier charges us for this line, in EUR. */
    netEur?: number;
  }>;
  repriced: { from: number; to: number } | null;
  /** The hotel quoted a different total than the search showed. */
  stayRepriced: { from: number; to: number } | null;
  /** Machine-readable failure reason, e.g. "offer-expired". */
  reason: string | null;
  testMode: boolean;
  /** Calendar events for the booked legs, ready for .ics / Google Calendar. */
  calendar: CalendarEvent[];
  /** Loyalty numbers we passed to the suppliers, and any they could not take. */
  loyalty: {
    applied: Array<{ programme: string; masked: string; tier: string | null; where: string }>;
    notApplied: Array<{ programme: string; masked: string; note: string }>;
  };
  /** Travel credit taken off this trip, and what is left afterwards. */
  credit?: { appliedEur: number; remainingEur: number };
  /** What was charged and how, for the receipt. */
  payment: {
    method: "card" | "saved-card" | "balance";
    brand: string | null;
    last4: string | null;
    amountEur: number;
    status: string;
  } | null;
};

type CardItems = {
  search: TripSearchResponse;
  priced: { flight: number | null; stay: number | null; car: number | null; total: number };
  insurance?: InsuranceQuote | null;
};

/** Analytics sink; never allowed to break a booking. */
async function recordEvent(
  userId: string,
  name: string,
  props: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("events").insert({ name, user_id: userId, props: props as never });
  } catch (error) {
    console.error("event insert failed", error);
  }
}

export const bookTripCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data, context }): Promise<BookingResult> => {
    const { supabase, userId } = context;
    void recordEvent(userId, "booking_started", { card_id: data.cardId });
    const [{ getOffer, createFlightOrder }, pricing, { isTestKey }] = await Promise.all([
      import("@/lib/trip/duffel-book.server"),
      import("@/lib/pricing.server"),
      import("@/lib/trip/duffel.server"),
    ]);

    const cardRes = await supabase
      .from("trip_cards")
      .select("id, items, status, expires_at")
      .eq("user_id", userId)
      .eq("id", data.cardId)
      .maybeSingle();
    if (cardRes.error) throw new Error(cardRes.error.message);
    if (!cardRes.data) throw new Error("card-not-found");
    const card = cardRes.data as unknown as {
      id: string;
      items: CardItems;
      status: string;
      expires_at: string | null;
    };
    // A settled payment already exists for this card: a retry must never charge
    // twice, so stop before touching the supplier.
    const idempotencyKey = paymentKey(card.id);
    const earlier = await supabase
      .from("payments")
      .select("status")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (
      shouldStopBeforeSupplier({
        cardStatus: card.status,
        earlierPaymentStatus: (earlier.data as { status?: string } | null)?.status ?? null,
      })
    ) {
      throw new Error("already-booked");
    }

    // Which provider takes the money is a config row, read through the adapter
    // interface — this flow never touches a provider SDK.
    const { paymentProvider } = await import("@/lib/payments/registry.server");
    const activeProvider = await paymentProvider(supabase);
    const adapter = activeProvider.status === "ok" ? activeProvider.data : null;

    const paymentMethod: "card" | "saved-card" | "balance" = data.payment?.method ?? "balance";
    const cardPayment =
      data.payment && data.payment.threeDSecureSessionId
        ? { threeDSecureSessionId: data.payment.threeDSecureSessionId }
        : null;
    const paymentDetails = {
      provider: adapter ? adapter.id : "none",
      settlement_model: adapter ? adapter.settlementModel : null,
      method: paymentMethod,
      card_brand: data.payment?.brand ?? null,
      card_last4: data.payment?.last4 ?? null,
      three_ds_status: cardPayment ? "authenticated" : null,
    };
    const settledStatus = adapter?.isTestMode() ? "test_settled" : "settled";

    const search = card.items.search;
    const priced = card.items.priced;
    const request = search.request;

    // Loyalty numbers from the traveller's wallet, decrypted server-side only.
    const { loadEarningRules, loadMemberships } = await import("@/lib/loyalty/booking.server");
    const { earnsOn, earnsOnWithGroup } = await import("@/lib/loyalty/earning");
    const { BRAND_SEED } = await import("@/lib/brands/catalogue");
    const memberships = await loadMemberships(userId);
    const earningRules = await loadEarningRules();
    const mask = (last4: string) => (last4 ? `•••• ${last4}` : "no number");
    const loyaltyApplied: BookingResult["loyalty"]["applied"] = [];
    const loyaltyNotApplied: BookingResult["loyalty"]["notApplied"] = [];

    // A programme with no member number cannot credit anything — say so plainly.
    for (const m of memberships.filter((m) => !m.hasNumber)) {
      loyaltyNotApplied.push({
        programme: m.programmeLabel,
        masked: "no number",
        note: "no number, not applied",
      });
    }
    const usable = memberships.filter((m) => m.hasNumber);

    // Programmes earn across partners, not only on the airline that owns them:
    // a LOT ticket credits Miles & More. The mapping lives in the database.
    const flightCarrierCode = search.flight?.flightNumbers[0]?.match(/^[A-Z0-9]{2}/)?.[0] ?? null;
    const flightMemberships = usable.filter(
      (m) =>
        m.category === "airline" &&
        (earnsOn(earningRules, "airline", m.programmeCode, flightCarrierCode) ||
          (m.airlineIata !== null && m.airlineIata === flightCarrierCode)),
    );
    // Each passenger gets their own cards, not just the lead traveller's — a
    // membership tagged with a companion's travel_companions id is grouped
    // under that id; an untagged one (travellerId null) belongs to whoever
    // is passenger 0.
    const flightAccountsByTraveller = new Map<
      string | null,
      Array<{ airlineIataCode: string; accountNumber: string }>
    >();
    for (const m of flightMemberships.filter((m) => m.airlineIata ?? flightCarrierCode)) {
      const key = m.travellerId ?? null;
      const list = flightAccountsByTraveller.get(key) ?? [];
      list.push({
        airlineIataCode: (flightCarrierCode ?? m.airlineIata) as string,
        accountNumber: m.memberNumber,
      });
      flightAccountsByTraveller.set(key, list);
    }
    for (const m of usable.filter(
      (m) => m.category === "airline" && !flightMemberships.includes(m),
    )) {
      loyaltyNotApplied.push({
        programme: m.programmeLabel,
        masked: mask(m.last4),
        note: "this flight's airline doesn't earn in this programme",
      });
    }

    const hotelName = search.stay?.name ?? null;
    const carSupplier = search.car ? `${search.car.supplier} ${search.car.vehicle}` : null;
    // A traveller may hold several hotel or rental programmes. All of them are
    // checked; the desk can only credit one, so the first match is passed on and
    // the other matching ones are reported honestly rather than as "no earn".
    const hotelMatches = usable.filter(
      (m) =>
        m.category === "hotel" &&
        earnsOnWithGroup(earningRules, BRAND_SEED, "hotel", m.programmeCode, hotelName),
    );
    const carMatches = usable.filter(
      (m) =>
        m.category === "car" &&
        earnsOnWithGroup(earningRules, BRAND_SEED, "car", m.programmeCode, carSupplier),
    );
    const hotelMembership = hotelMatches[0] ?? null;
    const carMembership = carMatches[0] ?? null;

    const lines: BookingResult["lines"] = [];
    let repriced: BookingResult["repriced"] = null;
    let stayRepriced: BookingResult["stayRepriced"] = null;
    let stayLoyaltySent = false;
    let flightOrderId: string | null = null;
    let flightReference: string | null = null;
    let flightGross = 0;
    let flightNet = 0;
    // What a supplier charged this card directly. Duffel takes the airline's own
    // price straight off the traveller's card, so that part must not be charged
    // a second time when we capture the rest of the trip.
    let paidAtSupplierEur = 0;
    let failed = false;
    let reason: string | null = null;

    const planRes = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
    const plan = (planRes.data as { plan: string } | null)?.plan ?? "free";
    const table = await pricing.loadPricing(supabase, plan);

    // The airline's own bags and seats, re-read so we price what it still sells.
    let ancillaryOptions: import("@/lib/trip/ancillaries").AncillaryOption[] = [];
    const ancillaryChoices = data.ancillaries ?? [];
    if (data.include.flight && search.flight?.offerId && ancillaryChoices.length > 0) {
      try {
        const { getOfferAncillaries } = await import("@/lib/trip/duffel-book.server");
        const result = await getOfferAncillaries(search.flight.offerId, table.extras);
        ancillaryOptions = result.options;
      } catch (error) {
        console.error("ancillaries re-read failed", error);
      }
    }
    const availableIds = new Set(ancillaryOptions.map((o) => o.id));
    const services = ancillaryChoices.filter((c) => availableIds.has(c.id));

    if (data.include.flight && search.flight?.offerId) {
      try {
        const offer = await getOffer(search.flight.offerId);
        if (Math.abs(offer.totalAmount - search.flight.amount) > 0.01) {
          repriced = { from: search.flight.amount, to: offer.totalAmount };
        }
        const order = await createFlightOrder({
          offerId: offer.id,
          amount: offer.totalAmount,
          currency: offer.currency,
          passengerIds: offer.passengerIds,
          traveller: data.traveller,
          companions: (data.companions ?? []).map((c) => ({
            ...c,
            travellerId: c.travellerId ?? null,
          })),
          services,
          idempotencyKey: `${card.id}-flight`,
          cardPayment,
          loyaltyAccountsByTraveller: flightAccountsByTraveller,
        });
        for (const m of flightMemberships) {
          loyaltyApplied.push({
            programme: m.programmeLabel,
            masked: mask(m.last4),
            tier: m.tier,
            where: "sent to the airline on this ticket",
          });
        }
        flightOrderId = order.id;
        flightReference = order.bookingReference;
        flightNet = search.flight.amountEur;
        if (cardPayment) paidAtSupplierEur += flightNet;
        // The card already holds the traveller price; only recompute if missing.
        flightGross =
          priced.flight ?? pricing.fromMinor(pricing.grossMinor(flightNet, table.flight));
        lines.push({
          kind: "flight",
          title: `${search.flight.carrier} ${search.flight.flightNumbers.join(" / ")}`,
          status: "confirmed",
          amountEur: flightGross,
          reference: order.bookingReference,
          note: null,
          supplierOrderId: order.id,
          netEur: flightNet,
          payload: {
            route: `${request.originIata} → ${request.destinationIata}`,
            returnRoute: `${request.destinationIata} → ${request.originIata}`,
            departAt: search.flight.departAt,
            arriveAt: search.flight.arriveAt,
            returnDepartAt: search.flight.returnDepartAt,
          },
        });

        // One line per chosen bag or seat, priced with the extras markup.
        const { ancillaryLines } = await import("@/lib/trip/ancillaries");
        for (const extra of ancillaryLines(ancillaryOptions, services)) {
          lines.push({
            kind: "extra",
            title: extra.quantity > 1 ? `${extra.title} × ${extra.quantity}` : extra.title,
            status: "confirmed",
            amountEur: extra.priceEur,
            reference: order.bookingReference,
            note: extra.detail || null,
            payload: { serviceId: extra.id, quantity: extra.quantity },
          });
        }
      } catch (error) {
        failed = true;
        const message = error instanceof Error ? error.message : "unknown";
        reason =
          message === "offer-gone" || message === "duffel-422" || message === "duffel-404"
            ? "offer-expired"
            : message === "missing-key"
              ? "supplier-not-configured"
              : "supplier-error";
        lines.push({
          kind: "flight",
          title: search.flight
            ? `${search.flight.carrier} ${search.flight.flightNumbers.join(" / ")}`
            : "Flight",
          status: "failed",
          amountEur: 0,
          reference: null,
          note: reason,
        });
      }
    }

    // Stays go through Duffel Stays: quote the rate, then book it. Until the
    // product is enabled on the account the supplier answers 401/403 and the
    // stay stays a requested line, exactly as before — nothing is charged.
    // Cars follow the same quote-then-book shape below, through Duffel Cars.
    if (data.include.stay && search.stay) {
      const stay = search.stay;
      const stayPayload: ItemCalendarPayload = {
        checkin: request.departDate,
        checkout: request.returnDate,
        address: stay.address ?? request.destinationCity,
        loyaltyProgramme: hotelMembership?.programmeLabel ?? null,
        loyaltyMemberMasked: hotelMembership ? mask(hotelMembership.last4) : null,
      };
      const pushRequested = () =>
        lines.push({
          kind: "stay",
          title: stay.name,
          status: "requested",
          amountEur: priced.stay ?? 0,
          reference: null,
          note: "supplier-not-enabled",
          payload: stayPayload,
        });

      if (!stay.rateId) {
        pushRequested();
      } else {
        const { bookStay, freeCancellationUntil } = await import("@/lib/trip/duffel-stays.server");
        const outcome = await bookStay({
          rateId: stay.rateId,
          expectedAmount: stay.amount,
          guests: [
            { givenName: data.traveller.givenName, familyName: data.traveller.familyName },
            ...(data.companions ?? []).map((c) => ({
              givenName: c.givenName,
              familyName: c.familyName,
            })),
          ],
          email: data.traveller.email,
          phone: data.traveller.phone,
          loyaltyProgrammeAccountNumber: hotelMembership?.memberNumber ?? null,
          idempotencyKey: `${card.id}-stay`,
          cardPayment,
        });

        if (outcome.status === "not-enabled") {
          pushRequested();
        } else if (outcome.status === "failed") {
          // A live product that could not book: the line fails, the trip is
          // partial, and the hotel amount never reaches the total.
          failed = true;
          reason = reason ?? `stay-${outcome.reason}`;
          lines.push({
            kind: "stay",
            title: stay.name,
            status: "failed",
            amountEur: 0,
            reference: null,
            note: outcome.reason,
            payload: stayPayload,
          });
        } else {
          stayRepriced = outcome.repriced;
          stayLoyaltySent = outcome.loyaltySent;
          // Net follows the quote when the hotel repriced; gross is what the
          // card already showed the traveller, recomputed only when missing.
          const ratio = outcome.repriced ? outcome.repriced.to / outcome.repriced.from : 1;
          const stayNet = Math.round(stay.amountEur * ratio * 100) / 100;
          const stayGross =
            priced.stay ?? pricing.fromMinor(pricing.grossMinor(stayNet, table.stay));
          const freeUntil = freeCancellationUntil(outcome.quote.cancellationTimeline);
          lines.push({
            kind: "stay",
            title: stay.name,
            status: "confirmed",
            amountEur: stayGross,
            reference: outcome.booking.bookingReference,
            note: null,
            supplierOrderId: outcome.booking.id,
            netEur: stayNet,
            payload: {
              ...stayPayload,
              note: freeUntil ? `Free cancellation until ${freeUntil}` : null,
            },
          });
        }
      }
    }
    if (data.include.car && search.car) {
      const car = search.car;
      const carPayload: ItemCalendarPayload = {
        pickup: request.departDate,
        dropoff: request.returnDate,
        location: request.destinationCity,
        loyaltyProgramme: carMembership?.programmeLabel ?? null,
        loyaltyMemberMasked: carMembership ? mask(carMembership.last4) : null,
      };
      const pushRequestedCar = () =>
        lines.push({
          kind: "car",
          title: `${car.vehicle} · ${car.supplier}`,
          status: "requested",
          amountEur: priced.car ?? 0,
          reference: null,
          note: "supplier-not-enabled",
          payload: carPayload,
        });

      if (!car.rateId) {
        pushRequestedCar();
      } else {
        const { bookCar } = await import("@/lib/trip/duffel-cars.server");
        const outcome = await bookCar({
          rateId: car.rateId,
          expectedAmount: car.amount,
          driver: {
            givenName: data.traveller.givenName,
            familyName: data.traveller.familyName,
            bornOn: data.traveller.bornOn,
            email: data.traveller.email,
            phone: data.traveller.phone,
          },
          idempotencyKey: `${card.id}-car`,
          cardPayment,
        });

        if (outcome.status === "not-enabled") {
          pushRequestedCar();
        } else if (outcome.status === "failed") {
          // A live product that could not book: the line fails, the trip is
          // partial, and the car amount never reaches the total.
          failed = true;
          reason = reason ?? `car-${outcome.reason}`;
          lines.push({
            kind: "car",
            title: `${car.vehicle} · ${car.supplier}`,
            status: "failed",
            amountEur: 0,
            reference: null,
            note: outcome.reason,
            payload: carPayload,
          });
        } else {
          const ratio = outcome.repriced ? outcome.repriced.to / outcome.repriced.from : 1;
          const carNet = Math.round(car.amountEur * ratio * 100) / 100;
          const carGross = priced.car ?? pricing.fromMinor(pricing.grossMinor(carNet, table.car));
          lines.push({
            kind: "car",
            title: `${car.vehicle} · ${car.supplier}`,
            status: "confirmed",
            amountEur: carGross,
            reference: outcome.booking.bookingReference,
            note: null,
            supplierOrderId: outcome.booking.id,
            netEur: carNet,
            payload: carPayload,
          });
        }
      }
    }

    if (!flightMemberships.length && lines.some((l) => l.kind === "flight")) {
      loyaltyNotApplied.push({
        programme: "No loyalty programme applies to this flight",
        masked: "",
        note: usable.some((m) => m.category === "airline")
          ? "none of your airline programmes earn on this carrier"
          : "no airline programme with a number in your wallet",
      });
    }
    for (const m of usable.filter((m) => m.category === "hotel" && m !== hotelMembership)) {
      loyaltyNotApplied.push({
        programme: m.programmeLabel,
        masked: mask(m.last4),
        note: hotelMatches.includes(m)
          ? "only one hotel programme can be credited per stay"
          : "this hotel doesn't earn in this programme",
      });
    }
    for (const m of usable.filter((m) => m.category === "car" && m !== carMembership)) {
      loyaltyNotApplied.push({
        programme: m.programmeLabel,
        masked: mask(m.last4),
        note: carMatches.includes(m)
          ? "only one rental programme can be credited per booking"
          : "this rental company doesn't earn in this programme",
      });
    }

    if (hotelMembership && lines.some((l) => l.kind === "stay")) {
      loyaltyApplied.push({
        programme: hotelMembership.programmeLabel,
        masked: mask(hotelMembership.last4),
        tier: hotelMembership.tier,
        where: stayLoyaltySent
          ? "sent to the hotel with the booking"
          : "stored on the stay, quote it at check-in",
      });
    }
    if (carMembership && lines.some((l) => l.kind === "car")) {
      loyaltyApplied.push({
        programme: carMembership.programmeLabel,
        masked: mask(carMembership.last4),
        tier: carMembership.tier,
        where: "sent with the car booking",
      });
    }

    // In-app insurance offer: priced from our own rate table, no external order.
    const insurance = card.items.insurance ?? null;
    // A trip card saved before insurance was withdrawn can still carry a quote;
    // it must not turn into a paid line on the strength of a stale card.
    const insuranceOptedIn = INSURANCE_AVAILABLE && Boolean(data.include.insurance && insurance);
    if (insuranceOptedIn && insurance) {
      lines.push({
        kind: "insurance",
        title: INSURANCE_TITLE,
        status: "confirmed",
        amountEur: insurance.grossEur,
        reference: null,
        note: INSURANCE_NOTE,
        payload: { note: INSURANCE_NOTE },
      });
    }

    // Airport transfers. Booked through the enabled ride provider when one is
    // connected; otherwise stored as a requested line with no price, so the
    // itinerary carries the pickup details without inventing a fare.
    const wantedRides = data.include.rides ?? [];
    if (wantedRides.length && search.flight) {
      const [{ ridePlansFor }, registry] = await Promise.all([
        import("@/lib/suppliers/rides/plan"),
        import("@/lib/suppliers/registry.server"),
      ]);
      const provider = await registry.rideProvider(supabase);
      for (const plan of ridePlansFor(search).filter((p) => wantedRides.includes(p.leg))) {
        const payload: ItemCalendarPayload = {
          pickupAt: plan.pickupAt,
          pickupAddress: plan.pickupAddress,
          dropoffAddress: plan.dropoffAddress,
        };
        if (provider.status !== "ok") {
          lines.push({
            kind: "ride",
            title: plan.label,
            status: "requested",
            amountEur: 0,
            reference: null,
            note: "transfer-provider-not-connected",
            payload,
          });
          continue;
        }
        const found = await provider.data.search(plan);
        const quote = found.status === "ok" ? found.data[0] : null;
        if (!quote) {
          lines.push({
            kind: "ride",
            title: plan.label,
            status: "requested",
            amountEur: 0,
            reference: null,
            note: "transfer-provider-not-connected",
            payload,
          });
          continue;
        }
        const order = await provider.data.book(plan, quote.quoteRef, {
          givenName: data.traveller.givenName,
          familyName: data.traveller.familyName,
          email: data.traveller.email,
          phone: data.traveller.phone,
        });
        const gross = pricing.fromMinor(pricing.grossMinor(quote.netEur, table.ride));
        lines.push({
          kind: "ride",
          title: `${plan.label} · ${quote.providerLabel}`,
          status: order.status === "ok" ? "confirmed" : "requested",
          amountEur: order.status === "ok" ? gross : 0,
          reference: order.status === "ok" ? order.data.reference : null,
          note: order.status === "ok" ? null : "transfer-provider-not-connected",
          payload,
        });
      }
    }

    if (!lines.length) throw new Error("nothing-selected");

    // Only what somebody actually sold us. A "requested" line — a hotel whose
    // supplier product is not enabled, a car no provider sells through an API —
    // was carrying its full price into this total, so the traveller was told
    // they owed money for a room that was never booked and never would be.
    const confirmedTotal = chargeableTotalEur(lines);
    const status: BookingResult["status"] = lines.every((l) => l.status === "failed")
      ? "failed"
      : failed
        ? "partial"
        : "confirmed";

    const audit = async (action: string, after: unknown) => {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("audit_log")
          .insert({ actor: userId, action, entity: "trip_card", after: after as never });
      } catch (error) {
        console.error("audit_log insert failed", error);
      }
    };

    // Nothing at all could be booked: keep the card open so the traveller can
    // simply search again instead of ending up with an empty trip.
    if (status === "failed") {
      await supabase.from("payments").upsert(
        {
          user_id: userId,
          amount_minor: Math.round(priced.total * 100),
          status: "failed",
          idempotency_key: idempotencyKey,
          failure_note: reason,
          ...paymentDetails,
        },
        { onConflict: "user_id,idempotency_key" },
      );
      // Nothing was bought, so the hold on the card is released now rather than
      // left to expire on its own days later with the money still out of reach.
      if (adapter && cardPayment && adapter.settlementModel === "merchant-of-record") {
        try {
          await adapter.cancel(cardPayment.threeDSecureSessionId);
        } catch (error) {
          console.error("releasing the authorisation failed", error);
        }
      }
      await audit("booking_failed", { cardId: card.id, reason });
      void recordEvent(userId, "booking_failed", { cause: reason ?? "unknown", card_id: card.id });
      return {
        tripId: null,
        status,
        reference: null,
        totalEur: 0,
        lines,
        repriced,
        stayRepriced,
        reason,
        testMode: isTestKey(),
        calendar: [],
        loyalty: { applied: [], notApplied: loyaltyNotApplied },
        payment: {
          method: paymentMethod,
          brand: data.payment?.brand ?? null,
          last4: data.payment?.last4 ?? null,
          amountEur: 0,
          status: "failed",
        },
      };
    }

    const tripRow = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        title: `${request.destinationCity} · ${request.departDate} – ${request.returnDate}`,
        city: request.destinationCity,
        origin: request.originCity,
        start_date: request.departDate,
        end_date: request.returnDate,
        status: "booked",
        total_amount: confirmedTotal,
        card_id: card.id,
        company_id: data.companyId,
        booked_at: new Date().toISOString(),
        document_number: flightReference,
        data_source: "duffel-test",
        segments: request.stops ?? [],
      })
      .select("id")
      .single();
    if (tripRow.error) throw new Error(tripRow.error.message);
    const tripId = (tripRow.data as { id: string }).id;

    const itemsInsert = lines.map((line, index) => ({
      trip_id: tripId,
      user_id: userId,
      kind: line.kind,
      type: line.kind,
      title: line.title,
      detail: line.note,
      status: line.status,
      supplier:
        line.kind === "insurance"
          ? "adair"
          : line.kind === "ride" || line.kind === "restaurant"
            ? "partner"
            : "duffel",
      supplier_order_id: line.supplierOrderId ?? (line.kind === "flight" ? flightOrderId : null),
      offer_reference: line.reference,
      amount: line.amountEur,
      net_minor:
        typeof line.netEur === "number"
          ? Math.round(line.netEur * 100)
          : line.kind === "flight"
            ? Math.round(flightNet * 100)
            : line.kind === "insurance"
              ? Math.round((insurance?.netEur ?? 0) * 100)
              : 0,
      gross_minor: Math.round(line.amountEur * 100),
      position: index,
      payload: (line.payload ?? {}) as never,
      documents: [],
    }));
    const itemsRes = await supabase.from("trip_items").insert(itemsInsert).select("id, position");
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    void recordEvent(userId, "booking_completed", {
      card_id: card.id,
      status,
      total_eur: confirmedTotal,
    });
    const insertedIds = new Map(
      ((itemsRes.data ?? []) as Array<{ id: string; position: number }>).map((r) => [
        r.position,
        r.id,
      ]),
    );

    await supabase
      .from("trip_cards")
      .update({ status: "booked" })
      .eq("id", card.id)
      .eq("user_id", userId);

    // What they actually booked, remembered against this city, so the next
    // trip here can start from it.
    try {
      const { rememberChoice } = await import("@/lib/trip/memory.server");
      const place = {
        city: request.destinationCity,
        iata: request.destinationIata,
        source: "booked" as const,
      };
      if (data.include.stay && search.stay?.name)
        await rememberChoice(supabase, userId, {
          ...place,
          itemKind: "hotel",
          itemName: search.stay.name,
        });
      if (data.include.car && search.car?.supplier)
        await rememberChoice(supabase, userId, {
          ...place,
          itemKind: "car_supplier",
          itemName: search.car.supplier,
        });
      if (data.include.flight && search.flight?.carrier)
        await rememberChoice(supabase, userId, {
          ...place,
          itemKind: "airline",
          itemName: search.flight.carrier,
        });
    } catch (error) {
      console.error("place memory write failed", error);
    }

    // Remember the people travelling along, encrypted, for the next booking.
    try {
      const remembered = (data.companions ?? []).filter((c) => c.remember);
      if (remembered.length > 0) {
        const { encryptSecret } = await import("@/lib/loyalty/crypto.server");
        const rows = [];
        for (const c of remembered) {
          const passport = c.passport?.number?.trim() || null;
          rows.push({
            user_id: userId,
            label: `${c.givenName} ${c.familyName}`.trim(),
            given_name_encrypted: await encryptSecret(c.givenName),
            family_name_encrypted: await encryptSecret(c.familyName),
            born_on_encrypted: await encryptSecret(c.bornOn),
            passport_number_encrypted: passport ? await encryptSecret(passport) : null,
            passport_last4: passport ? passport.slice(-4) : null,
          });
        }
        await supabase.from("travel_companions").insert(rows as never);
      }
    } catch (error) {
      console.error("saving companions failed", error);
    }

    // Travel credit comes off this trip, and a referral pays out on the
    // invited traveller's first confirmed booking. Never block the booking.
    let creditAppliedMinor = 0;
    let creditRemainingMinor = 0;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { availableCreditMinor, creditToApply, spendCredit, grantReferralRewards } =
        await import("@/lib/referrals.server");
      const balance = await availableCreditMinor(supabase as never, userId);
      creditAppliedMinor = creditToApply(balance, Math.round(confirmedTotal * 100));
      creditRemainingMinor = Math.max(0, balance - creditAppliedMinor);
      await spendCredit(supabaseAdmin as never, userId, tripId, creditAppliedMinor);
      await grantReferralRewards(supabaseAdmin as never, userId, tripId);
    } catch (error) {
      console.error("credit/referral step failed", error);
      creditAppliedMinor = 0;
      creditRemainingMinor = 0;
    }

    // Creator commission: a share of our margin, pending until the
    // free-cancellation window passes. Never blocks the booking.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { accrueCreatorEarnings } = await import("@/lib/creators.server");
      await accrueCreatorEarnings(
        supabaseAdmin as never,
        userId,
        tripId,
        lines.map((line, index) => {
          const payload = (line.payload ?? {}) as Record<string, unknown>;
          return {
            tripItemId: insertedIds.get(index) ?? null,
            kind: line.kind,
            grossMinor: Math.round(line.amountEur * 100),
            netMinor:
              line.kind === "flight"
                ? Math.round(flightNet * 100)
                : line.kind === "insurance"
                  ? Math.round((insurance?.netEur ?? 0) * 100)
                  : null,
            status: line.status,
            getawayPlaceId:
              typeof payload["getawayPlaceId"] === "string"
                ? (payload["getawayPlaceId"] as string)
                : null,
          };
        }),
      );
    } catch (error) {
      console.error("creator commission step failed", error);
    }

    // Take the money. Everything above this point booked a trip; without this
    // the traveller was invoiced for a total nobody ever collected, because the
    // authorisation was never captured and quietly expired.
    let settlement = { captureMinor: 0, note: "no card authorisation to capture" };
    let captureFailed: string | null = null;
    if (adapter && cardPayment) {
      const { settlementFor } = await import("@/lib/payments/settle");
      settlement = settlementFor({
        confirmedTotalEur: confirmedTotal,
        creditAppliedMinor,
        paidAtSupplierEur,
        settlementModel: adapter.settlementModel,
      });
      try {
        const outcome =
          settlement.captureMinor > 0
            ? await adapter.capture(cardPayment.threeDSecureSessionId, settlement.captureMinor)
            : await adapter.cancel(cardPayment.threeDSecureSessionId);
        if (outcome.status !== "ok") {
          captureFailed = outcome.status;
          console.error("capture failed", outcome);
        }
      } catch (error) {
        captureFailed = "capture-threw";
        console.error("capture threw", error);
      }
      // A capture that does not go through is money we are owed on a trip that
      // is already booked, so it is recorded as such rather than swallowed.
      await audit(captureFailed ? "payment_capture_failed" : "payment_captured", {
        tripId,
        amountMinor: settlement.captureMinor,
        note: settlement.note,
        provider: adapter.id,
        error: captureFailed,
      });
    }

    await supabase.from("payments").upsert(
      {
        user_id: userId,
        trip_id: tripId,
        provider_ref: flightOrderId,
        amount_minor: Math.max(0, Math.round(confirmedTotal * 100) - creditAppliedMinor),
        captured_minor: captureFailed ? 0 : settlement.captureMinor,
        capture_note: captureFailed ? `${settlement.note} — ${captureFailed}` : settlement.note,
        status: captureFailed ? "capture_failed" : settledStatus,
        idempotency_key: idempotencyKey,
        failure_note: status === "partial" ? reason : null,
        ...paymentDetails,
      },
      { onConflict: "user_id,idempotency_key" },
    );

    await audit("booking_created", {
      cardId: card.id,
      tripId,
      status,
      totalEur: confirmedTotal,
      testMode: isTestKey(),
    });

    // Invoice by email to the chosen company. Never block the booking result.
    try {
      const company = data.companyId
        ? (
            await supabase
              .from("companies")
              .select(
                "name, legal_form, vat_id, country, city, postcode, street, building, address_extra, invoice_email, invoice_emails",
              )
              .eq("id", data.companyId)
              .eq("user_id", userId)
              .maybeSingle()
          ).data
        : null;
      if (company) {
        const c = company as Record<string, unknown>;
        const raw = Array.isArray(c["invoice_emails"]) ? (c["invoice_emails"] as string[]) : [];
        const emails = [...raw, (c["invoice_email"] as string | null) ?? ""].filter(
          (e): e is string => typeof e === "string" && e.trim().length > 0,
        );
        const line = (key: string) => (c[key] as string | null) ?? null;
        const address = [
          [line("street"), line("building")].filter(Boolean).join(" "),
          line("address_extra"),
          [line("postcode"), line("city")].filter(Boolean).join(" "),
          line("country"),
        ].filter((v): v is string => Boolean(v && v.trim()));
        const { sendInvoiceEmail } = await import("@/lib/invoice-email.server");
        await sendInvoiceEmail({
          to: Array.from(new Set(emails)),
          documentNumber: flightReference ?? tripId,
          companyName: [line("name"), line("legal_form")].filter(Boolean).join(" ") || null,
          companyVatId: line("vat_id"),
          companyAddress: address,
          origin: request.originCity,
          destination: request.destinationCity,
          startDate: request.departDate,
          endDate: request.returnDate,
          totalEur: confirmedTotal,
          testMode: isTestKey(),
          lines: lines.map((l) => ({
            kind: l.kind,
            title: l.title,
            detail: l.note ?? null,
            reference: l.reference,
            amountEur: l.amountEur,
          })),
        });
      }
    } catch (error) {
      console.error("invoice email failed", error);
    }

    // Push the trip into every connected calendar. Never blocks the booking.
    try {
      const { syncTripToCalendars } = await import("@/lib/calendar/sync.server");
      await syncTripToCalendars(supabase, userId, {
        id: tripId,
        title: `${request.destinationCity} · ${request.departDate} – ${request.returnDate}`,
        city: request.destinationCity,
        startDate: request.departDate,
        endDate: request.returnDate,
        reference: flightReference,
        items: lines.map((line, index) => ({
          id: insertedIds.get(index) ?? `${tripId}-${index}`,
          kind: line.kind,
          title: line.title,
          status: line.status,
          reference: line.reference,
          payload: line.payload ?? null,
          eventIds: {},
        })),
      });
    } catch (error) {
      console.error("calendar sync failed", error);
    }

    // Confirmation on the traveller's chosen channel. Never blocks the booking.
    try {
      const { loadChannel, notifyTraveller } = await import("@/lib/notifications/send.server");
      const channel = await loadChannel(supabase, userId);
      const email = context.claims?.["email"];
      await notifyTraveller(supabase, {
        userId,
        kind: "booking_confirmation",
        params: [
          request.destinationCity,
          `${request.departDate} – ${request.returnDate}`,
          flightReference ?? tripId,
        ],
        email:
          typeof email === "string" && email
            ? {
                to: email,
                subject: `Your trip to ${request.destinationCity} is confirmed`,
                html: `<p>Your trip to ${request.destinationCity}, ${request.departDate} – ${request.returnDate}, is confirmed.</p><p>Reference ${flightReference ?? tripId}.</p><p>Adair</p>`,
              }
            : null,
        ...channel,
      });
    } catch (error) {
      console.error("booking notification failed", error);
    }

    const calendar = tripCalendarEvents({
      id: tripId,
      title: `${request.destinationCity} · ${request.departDate} – ${request.returnDate}`,
      city: request.destinationCity,
      startDate: request.departDate,
      endDate: request.returnDate,
      reference: flightReference,
      items: lines.map((line, index) => ({
        id: insertedIds.get(index) ?? `${tripId}-${index}`,
        kind: line.kind,
        title: line.title,
        status: line.status,
        reference: line.reference,
        payload: line.payload ?? null,
      })),
    });

    return {
      tripId,
      status,
      reference: flightReference,
      totalEur: confirmedTotal,
      lines,
      repriced,
      stayRepriced,
      reason,
      testMode: isTestKey(),
      calendar,
      loyalty: { applied: loyaltyApplied, notApplied: loyaltyNotApplied },
      credit: {
        appliedEur: creditAppliedMinor / 100,
        remainingEur: creditRemainingMinor / 100,
      },
      payment: {
        method: paymentMethod,
        brand: data.payment?.brand ?? null,
        last4: data.payment?.last4 ?? null,
        amountEur: Math.max(0, confirmedTotal - creditAppliedMinor / 100),
        status: "test_settled",
      },
    };
  });

/** Stored stop list, falling back to origin + destination from the city map. */
function tripStops(raw: unknown, origin: string | null, city: string | null): TripStop[] {
  if (Array.isArray(raw) && raw.length) {
    return raw.filter(
      (s): s is TripStop =>
        Boolean(s) &&
        typeof (s as TripStop).city === "string" &&
        typeof (s as TripStop).lat === "number",
    );
  }
  const byName = (name: string | null) =>
    name ? CITIES.find((c) => c.city.toLowerCase() === name.toLowerCase()) : undefined;
  return [byName(origin), byName(city)]
    .filter((c): c is (typeof CITIES)[number] => Boolean(c))
    .map((c) => ({ city: c.city, iata: c.iata, lat: c.lat, lon: c.lon }));
}

export type MyTrip = {
  id: string;
  title: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  totalEur: number;
  reference: string | null;
  /** True when the trip was created against the supplier's test environment. */
  testMode: boolean;
  /** Ordered stops, for the map view. */
  stops: TripStop[];
  items: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string | null;
    status: string;
    amountEur: number;
    reference: string | null;
    payload: ItemCalendarPayload | null;
  }>;
  /** Editorial notes for the destination; empty when the team hasn't written any. */
  tips: Array<{ key: string; label: string; text: string }>;
  /** The sentence this trip was composed from, for "Book again". */
  sentence: string | null;
};

export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyTrip[]> => {
    const { supabase, userId } = context;
    const tripsRes = await supabase
      .from("trips")
      .select(
        "id, title, city, origin, start_date, end_date, status, total_amount, document_number, data_source, segments, card_id, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (tripsRes.error) throw new Error(tripsRes.error.message);
    const trips = (tripsRes.data ?? []) as Array<{
      id: string;
      title: string;
      city: string | null;
      origin: string | null;
      start_date: string | null;
      end_date: string | null;
      status: string;
      total_amount: number;
      document_number: string | null;
      data_source: string | null;
      segments: unknown;
      card_id: string | null;
    }>;

    // The original sentence, so a past trip can be booked again.
    const cardIds = trips.map((t) => t.card_id).filter((id): id is string => Boolean(id));
    const sentenceByCard = new Map<string, string>();
    if (cardIds.length) {
      const cardsRes = await supabase
        .from("trip_cards")
        .select("id, trip_requests(raw_sentence)")
        .in("id", cardIds);
      for (const row of (cardsRes.data ?? []) as Array<{
        id: string;
        trip_requests:
          { raw_sentence: string | null } | Array<{ raw_sentence: string | null }> | null;
      }>) {
        const req = Array.isArray(row.trip_requests) ? row.trip_requests[0] : row.trip_requests;
        if (req?.raw_sentence) sentenceByCard.set(row.id, req.raw_sentence);
      }
    }

    if (!trips.length) return [];

    const itemsRes = await supabase
      .from("trip_items")
      .select(
        "id, trip_id, kind, title, detail, status, amount, offer_reference, position, payload",
      )
      .eq("user_id", userId)
      .in(
        "trip_id",
        trips.map((t) => t.id),
      )
      .order("position", { ascending: true });
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = (itemsRes.data ?? []) as Array<{
      id: string;
      trip_id: string;
      kind: string;
      title: string;
      detail: string | null;
      status: string;
      amount: number;
      offer_reference: string | null;
      payload: ItemCalendarPayload | null;
    }>;

    // Destination notes, shown once a trip is booked. Nothing is generated:
    // a destination with no editorial tips simply has none.
    const cities = Array.from(
      new Set(trips.map((t) => (t.city ?? "").trim()).filter((c) => c.length > 0)),
    );
    const tipsByCity = new Map<string, Array<{ key: string; label: string; text: string }>>();
    if (cities.length) {
      const { listTravelTips } = await import("@/lib/trip/tips");
      const destRes = await supabase
        .from("getaway_destinations")
        .select("name, travel_tips")
        .in("name", cities);
      for (const row of (destRes.data ?? []) as Array<{ name: string; travel_tips: unknown }>) {
        const tips = listTravelTips(row.travel_tips);
        if (tips.length) tipsByCity.set(row.name.toLowerCase(), tips);
      }
    }

    return trips.map((trip) => ({
      id: trip.id,
      title: trip.title,
      city: trip.city,
      startDate: trip.start_date,
      endDate: trip.end_date,
      status: trip.status,
      totalEur: Number(trip.total_amount),
      reference: trip.document_number,
      testMode: (trip.data_source ?? "").includes("test"),
      stops: tripStops(trip.segments, trip.origin, trip.city),
      sentence: trip.card_id ? (sentenceByCard.get(trip.card_id) ?? null) : null,

      items: items
        .filter((i) => i.trip_id === trip.id)
        .map((i) => ({
          id: i.id,
          kind: i.kind,
          title: i.title,
          detail: i.detail,
          status: i.status,
          amountEur: Number(i.amount),
          reference: i.offer_reference,
          payload: (i.payload ?? null) as ItemCalendarPayload | null,
        })),
      tips:
        trip.status === "cancelled" || !trip.city
          ? []
          : (tipsByCity.get(trip.city.trim().toLowerCase()) ?? []),
    }));
  });

export const cancelTripItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const itemRes = await supabase
      .from("trip_items")
      .select("id, kind, status, supplier_order_id, trip_id, amount")
      .eq("user_id", userId)
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemRes.error) throw new Error(itemRes.error.message);
    if (!itemRes.data) throw new Error("item-not-found");
    const item = itemRes.data as {
      id: string;
      kind: string;
      status: string;
      supplier_order_id: string | null;
      trip_id: string;
      amount: number;
    };
    if (item.status === "cancelled") return { status: "cancelled" as const };

    let status = "cancelled";
    if (item.kind === "flight" && item.supplier_order_id) {
      const { cancelFlightOrder } = await import("@/lib/trip/duffel-book.server");
      try {
        const result = await cancelFlightOrder(item.supplier_order_id);
        status = result.status;
      } catch {
        status = "cancel-requested";
      }
    }
    if (item.kind === "stay" && item.supplier_order_id) {
      const { cancelStayBooking } = await import("@/lib/trip/duffel-stays.server");
      try {
        const result = await cancelStayBooking(item.supplier_order_id);
        status = result.status;
      } catch {
        status = "cancel-requested";
      }
    }

    await supabase.from("trip_items").update({ status }).eq("id", item.id).eq("user_id", userId);

    // Remove this line's events from any connected calendar.
    const { removeItemFromCalendars } = await import("@/lib/calendar/sync.server");
    await removeItemFromCalendars(supabase, userId, item.id);

    const remaining = await supabase
      .from("trip_items")
      .select("amount, status")
      .eq("user_id", userId)
      .eq("trip_id", item.trip_id);
    const rows = (remaining.data ?? []) as Array<{ amount: number; status: string }>;
    const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "failed");
    await supabase
      .from("trips")
      .update({
        total_amount: active.reduce((sum, r) => sum + Number(r.amount), 0),
        status: active.length ? "booked" : "cancelled",
      })
      .eq("id", item.trip_id)
      .eq("user_id", userId);

    // A cancelled trip takes any creator commission with it.
    if (!active.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { reverseCreatorEarnings } = await import("@/lib/creators.server");
        await reverseCreatorEarnings(supabaseAdmin as never, item.trip_id);
      } catch (error) {
        console.error("creator reversal failed", error);
      }
    }

    return { status };
  });
