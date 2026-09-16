/**
 * "Shopping near your hotel" — public OpenStreetMap data around the hotel,
 * the same free source src/lib/places.functions.ts uses for restaurants and
 * bars. No key needed, so unlike events there is nothing to enable — this
 * just returns an empty list on any lookup failure rather than a guess.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAP_ATTRIBUTION, type Shop } from "@/lib/shopping/types";
import type { TripSearchResponse } from "@/lib/trip/types";

export type TripShopping = {
  city: string;
  attribution: string;
  any: boolean;
  shops: Shop[];
};

const EMPTY = (city = ""): TripShopping => ({
  city,
  attribution: MAP_ATTRIBUTION,
  any: false,
  shops: [],
});

export const getTripShopping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TripShopping> => {
    const { supabase, userId } = context;

    const tripRes = await supabase
      .from("trips")
      .select("id, city, card_id")
      .eq("user_id", userId)
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (!tripRes.data) throw new Error("trip-not-found");
    const trip = tripRes.data as { city: string | null; card_id: string | null };
    const city = trip.city ?? "";

    const cardRes = trip.card_id
      ? await supabase.from("trip_cards").select("items").eq("id", trip.card_id).maybeSingle()
      : { data: null };
    const search = (cardRes.data as { items?: { search?: TripSearchResponse } } | null)?.items
      ?.search;
    const point =
      search?.request.lat != null && search?.request.lon != null
        ? { lat: search.request.lat, lon: search.request.lon }
        : null;
    if (!point) return EMPTY(city);

    const { shopsNear } = await import("@/lib/shopping/osm.server");
    const shops = await shopsNear(supabase, point);
    shops.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    return { city, attribution: MAP_ATTRIBUTION, any: shops.length > 0, shops: shops.slice(0, 12) };
  });
