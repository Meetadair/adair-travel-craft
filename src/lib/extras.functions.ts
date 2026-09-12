/**
 * Optional extras on a trip card: airport transfers and dinner reservations.
 *
 * Everything shown here is either a live supplier answer or an honest
 * "not connected yet" state — no invented venue, price or availability.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RideClass, RideLeg, UnavailableReason } from "@/lib/suppliers/types";
import type { LineMatch } from "@/lib/trip/match";
import type { TripSearchResponse } from "@/lib/trip/types";

export type RideQuoteView = {
  quoteRef: string;
  providerLabel: string;
  vehicleClass: RideClass;
  etaMinutes: number | null;
  /** Traveller price, our ride margin already included. */
  grossEur: number;
};

export type RideOptionView = {
  leg: RideLeg;
  label: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupAt: string;
  passengers: number;
  quotes: RideQuoteView[];
};

export type RestaurantOfferView = {
  offerRef: string;
  providerLabel: string;
  name: string;
  cuisine: string | null;
  distanceKm: number | null;
  date: string;
  time: string;
  partySize: number;
  prepaymentEur: number | null;
  match: LineMatch | null;
};

export type CardExtras = {
  rides: {
    connected: boolean;
    reason: UnavailableReason | null;
    providerLabel: string | null;
    options: RideOptionView[];
  };
  restaurants: {
    connected: boolean;
    reason: UnavailableReason | null;
    providerLabel: string | null;
    partySize: number;
    criteria: string[];
    dates: string[];
    offers: RestaurantOfferView[];
  };
};

const cardInput = z.object({ cardId: z.string().uuid() });

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export const getCardExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cardInput.parse(input))
  .handler(async ({ data, context }): Promise<CardExtras> => {
    const { supabase, userId } = context;

    const [cardRes, prefsRes, profileRes] = await Promise.all([
      supabase
        .from("trip_cards")
        .select("items")
        .eq("user_id", userId)
        .eq("id", data.cardId)
        .maybeSingle(),
      supabase
        .from("preferences")
        .select("cuisines, diets, interests, hotel_max_km, budget_band")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    ]);
    if (cardRes.error) throw new Error(cardRes.error.message);
    if (!cardRes.data) throw new Error("card-not-found");

    const search = (cardRes.data as { items: { search: TripSearchResponse } }).items.search;
    const row = (prefsRes.data ?? null) as Record<string, unknown> | null;
    const prefs = {
      cuisines: list(row?.["cuisines"]),
      diets: list(row?.["diets"]),
      interests: list(row?.["interests"]),
      // The walking distance they accept between hotel and venue.
      maxKm: (row?.["hotel_max_km"] as number | null) ?? null,
      budgetBand: (row?.["budget_band"] as string | null) ?? null,
    };
    const plan = (profileRes.data as { plan: string } | null)?.plan ?? "free";

    const [{ ridePlansFor }, slots, registry, pricing, matchLib] = await Promise.all([
      import("@/lib/suppliers/rides/plan"),
      import("@/lib/suppliers/restaurants/slots"),
      import("@/lib/suppliers/registry.server"),
      import("@/lib/pricing.server"),
      import("@/lib/trip/match"),
    ]);

    const table = await pricing.loadPricing(supabase, plan);
    const plans = ridePlansFor(search);
    const partySize = Math.max(1, search.request.passengers);

    // ---- rides ----
    const rideAdapter = await registry.rideProvider(supabase);
    const rideOptions: RideOptionView[] = plans.map((p) => ({ ...p, quotes: [] }));
    let rideReason: UnavailableReason | null = null;
    let rideLabel: string | null = null;

    if (rideAdapter.status === "ok") {
      rideLabel = rideAdapter.data.label;
      for (const [index, p] of plans.entries()) {
        const found = await rideAdapter.data.search(p);
        if (found.status !== "ok") {
          rideReason = found.reason;
          continue;
        }
        const option = rideOptions[index];
        if (!option) continue;
        option.quotes = found.data.map((quote) => ({
          quoteRef: quote.quoteRef,
          providerLabel: quote.providerLabel,
          vehicleClass: quote.vehicleClass,
          etaMinutes: quote.etaMinutes,
          grossEur: pricing.fromMinor(pricing.grossMinor(quote.netEur, table.ride)),
        }));
      }
    } else {
      rideReason = rideAdapter.reason;
    }
    const ridesConnected = rideOptions.some((option) => option.quotes.length > 0);

    // ---- restaurants ----
    const dates = slots.dinnerDates(search);
    const restaurantAdapter = await registry.restaurantProvider(supabase);
    const offers: RestaurantOfferView[] = [];
    let restaurantReason: UnavailableReason | null = null;
    let restaurantLabel: string | null = null;

    if (restaurantAdapter.status === "ok") {
      restaurantLabel = restaurantAdapter.data.label;
      for (const date of dates) {
        const criteria = slots.dinnerCriteria(search, prefs, date);
        const found = await restaurantAdapter.data.search(criteria);
        if (found.status !== "ok") {
          restaurantReason = found.reason;
          continue;
        }
        for (const offer of found.data.slice(0, 3)) {
          offers.push({
            offerRef: offer.offerRef,
            providerLabel: offer.providerLabel,
            name: offer.name,
            cuisine: offer.cuisine,
            distanceKm: offer.distanceKm,
            date: offer.date,
            time: offer.time,
            partySize: offer.partySize,
            prepaymentEur: offer.prepaymentEur,
            match: matchLib.restaurantMatch(offer, prefs),
          });
        }
      }
    } else {
      restaurantReason = restaurantAdapter.reason;
    }

    return {
      rides: {
        connected: ridesConnected,
        reason: ridesConnected ? null : (rideReason ?? "no-provider"),
        providerLabel: rideLabel,
        options: rideOptions,
      },
      restaurants: {
        connected: offers.length > 0,
        reason: offers.length ? null : (restaurantReason ?? "no-provider"),
        providerLabel: restaurantLabel,
        partySize,
        criteria: slots.criteriaLabels(prefs, partySize),
        dates,
        offers,
      },
    };
  });

/**
 * "Add a reservation" on a confirmed trip. Books through the enabled
 * provider when one is connected; otherwise reports plainly that it is not.
 */
export const addTripReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        partySize: z.number().int().min(1).max(20),
        offerRef: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ status: "confirmed" | "unavailable"; reason?: UnavailableReason }> => {
      const { supabase, userId } = context;

      const tripRes = await supabase
        .from("trips")
        .select("id, city, segments")
        .eq("user_id", userId)
        .eq("id", data.tripId)
        .maybeSingle();
      if (tripRes.error) throw new Error(tripRes.error.message);
      if (!tripRes.data) throw new Error("trip-not-found");
      const trip = tripRes.data as { id: string; city: string | null };

      const [registry, prefsRes] = await Promise.all([
        import("@/lib/suppliers/registry.server"),
        supabase
          .from("preferences")
          .select("cuisines, diets, interests, hotel_max_km, budget_band")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      const adapter = await registry.restaurantProvider(supabase);
      if (adapter.status !== "ok") return { status: "unavailable", reason: adapter.reason };

      const row = (prefsRes.data ?? null) as Record<string, unknown> | null;
      const criteria = {
        city: trip.city ?? "",
        lat: null,
        lon: null,
        date: data.date,
        time: data.time,
        partySize: data.partySize,
        cuisines: list(row?.["cuisines"]),
        diets: list(row?.["diets"]),
        interests: list(row?.["interests"]),
        maxKm: (row?.["hotel_max_km"] as number | null) ?? null,
        budgetBand: (row?.["budget_band"] as string | null) ?? null,
      };

      const offerRef = data.offerRef ?? "";
      if (!offerRef) {
        const found = await adapter.data.search(criteria);
        if (found.status !== "ok") return { status: "unavailable", reason: found.reason };
        const first = found.data[0];
        if (!first) return { status: "unavailable", reason: "no-availability" };
        const booked = await adapter.data.book(criteria, first.offerRef);
        if (booked.status !== "ok") return { status: "unavailable", reason: booked.reason };
        await insertReservation(supabase, userId, trip.id, first, booked.data.reference);
        return { status: "confirmed" };
      }

      const quoted = await adapter.data.quote(criteria, offerRef);
      if (quoted.status !== "ok") return { status: "unavailable", reason: quoted.reason };
      const booked = await adapter.data.book(criteria, offerRef);
      if (booked.status !== "ok") return { status: "unavailable", reason: booked.reason };
      await insertReservation(supabase, userId, trip.id, quoted.data, booked.data.reference);
      return { status: "confirmed" };
    },
  );

async function insertReservation(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  offer: {
    name: string;
    cuisine: string | null;
    date: string;
    time: string;
    partySize: number;
    prepaymentEur: number | null;
    provider: string;
    providerLabel: string;
  },
  reference: string,
): Promise<void> {
  await supabase.from("trip_items").insert({
    trip_id: tripId,
    user_id: userId,
    kind: "restaurant",
    type: "restaurant",
    title: offer.name,
    detail: `${offer.date} ${offer.time} · table for ${offer.partySize}`,
    provider: offer.providerLabel,
    supplier: offer.provider,
    supplier_order_id: reference,
    status: "confirmed",
    amount: offer.prepaymentEur ?? 0,
    gross_minor: Math.round((offer.prepaymentEur ?? 0) * 100),
    payload: {
      reservationAt: `${offer.date}T${offer.time}`,
      partySize: offer.partySize,
      cuisine: offer.cuisine,
      venueName: offer.name,
    },
  });
}
