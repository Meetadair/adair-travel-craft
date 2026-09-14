/**
 * Everything the trip map needs, in one call.
 *
 * The hotel comes from what they actually booked, the meeting from what they
 * told us, the venues from the existing places logic, and the landmarks from
 * public map data. Assembling them here rather than in the browser keeps the
 * Overpass key-free requests server-side and cached.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { landmarksNear, type Landmark } from "@/lib/places/landmarks.server";
import { MAP_ATTRIBUTION, type RankedPlace } from "@/lib/places/types";
import { buildPins, type MapPin } from "@/lib/trips/map-pins";
import type { TripSearchResponse } from "@/lib/trip/types";
import { getTripPlaces } from "@/lib/places.functions";

export type TripMap = {
  city: string;
  attribution: string;
  pins: MapPin[];
  /** True when we know where the hotel is; without it there is no anchor. */
  anchored: boolean;
};

export const getTripMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TripMap> => {
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

    const stay = search?.stay ?? null;
    const hotel = stay ? { name: stay.name, lat: stay.lat ?? null, lon: stay.lon ?? null } : null;

    // Falls back to the destination centre so a trip without a hotel still has
    // a map — the pins are then measured from the city, and we say so.
    const anchor =
      hotel && typeof hotel.lat === "number" && typeof hotel.lon === "number"
        ? { lat: hotel.lat, lon: hotel.lon }
        : search?.request.lat != null && search?.request.lon != null
          ? { lat: search.request.lat, lon: search.request.lon }
          : null;

    if (!anchor) {
      return { city, attribution: MAP_ATTRIBUTION, pins: [], anchored: false };
    }

    const [placesResult, landmarks] = await Promise.all([
      getTripPlaces({ data: { tripId: data.tripId } }).catch(() => null),
      landmarksNear(supabase, anchor).catch((): Landmark[] => []),
    ]);

    const places: RankedPlace[] = (placesResult?.sections ?? []).flatMap(
      (section) => section.places,
    );

    const pins = buildPins({
      hotel: hotel ?? { name: city || "Your stay", lat: anchor.lat, lon: anchor.lon },
      // We know the meeting by name, not by coordinates, until a geocoder is
      // connected — so it is left off rather than pinned in the wrong street.
      meeting: null,
      places,
      landmarks,
    });

    return {
      city,
      attribution: MAP_ATTRIBUTION,
      pins,
      anchored: Boolean(hotel && typeof hotel.lat === "number"),
    };
  });
