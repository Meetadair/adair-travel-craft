/**
 * Places to go out on a trip, grouped by time of day.
 *
 * Curated entries (and creator-partner recommendations) come first, then public
 * map data. A place is either something someone wrote up or a map entry we
 * label as such — never a made-up venue, price or table.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bucketLabel, bucketsForDay, categoriesForBucket, type Bucket } from "@/lib/places/buckets";
import { rankPlaces, type PlaceProfile } from "@/lib/places/rank";
import {
  MAP_ATTRIBUTION,
  type Place,
  type PlaceCategory,
  type RankedPlace,
} from "@/lib/places/types";
import type { TripSearchResponse } from "@/lib/trip/types";

export type PlaceSection = {
  date: string;
  bucket: Bucket;
  label: string;
  places: RankedPlace[];
};

export type TripPlaces = {
  city: string;
  attribution: string;
  /** True when at least one place could be shown. */
  any: boolean;
  usesMapData: boolean;
  sections: PlaceSection[];
};

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const isCategory = (value: string): value is PlaceCategory =>
  ["restaurant", "cafe", "bar", "wine_bar", "cocktail_bar", "rooftop", "club"].includes(value);

const days = (start: string | null, end: string | null, max = 3): string[] => {
  if (!start) return [];
  const from = Date.parse(`${start}T12:00:00Z`);
  const to = Date.parse(`${end ?? start}T12:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [start];
  const out: string[] = [];
  for (let t = from; t <= to && out.length < max; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

const R = 6371;
const distanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
};

export const getTripPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TripPlaces> => {
    const { supabase, userId } = context;

    const tripRes = await supabase
      .from("trips")
      .select("id, city, start_date, end_date, card_id")
      .eq("user_id", userId)
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw new Error(tripRes.error.message);
    if (!tripRes.data) throw new Error("trip-not-found");
    const trip = tripRes.data as {
      city: string | null;
      start_date: string | null;
      end_date: string | null;
      card_id: string | null;
    };
    const city = trip.city ?? "";

    const [prefsRes, cardRes] = await Promise.all([
      supabase
        .from("preferences")
        .select("cuisines, diets, interests, hotel_max_km, budget_band, dealbreakers, trip_purpose")
        .eq("user_id", userId)
        .maybeSingle(),
      trip.card_id
        ? supabase.from("trip_cards").select("items").eq("id", trip.card_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const row = (prefsRes.data ?? null) as Record<string, unknown> | null;
    const purpose = list(row?.["trip_purpose"]).map((p) => p.toLowerCase());
    const profile: PlaceProfile = {
      cuisines: list(row?.["cuisines"]),
      diets: list(row?.["diets"]),
      interests: list(row?.["interests"]),
      maxKm: (row?.["hotel_max_km"] as number | null) ?? null,
      budgetBand: (row?.["budget_band"] as string | null) ?? null,
      dealbreakers: list(row?.["dealbreakers"]),
      withChildren: purpose.some((p) => p.includes("family") || p.includes("child")),
    };

    // The hotel is our reference point for distances and for the map search.
    const search = (cardRes.data as { items?: { search?: TripSearchResponse } } | null)?.items
      ?.search;
    const from =
      search?.request.lat != null && search?.request.lon != null
        ? { lat: search.request.lat, lon: search.request.lon }
        : null;

    /* ---- curated + creator places ---- */
    const curated: Place[] = [];
    if (city) {
      const destRes = await supabase
        .from("getaway_destinations")
        .select("id, name, latitude, longitude")
        .ilike("name", city)
        .limit(1);
      const dest = ((destRes.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
      if (dest) {
        const placesRes = await supabase
          .from("getaway_places")
          .select(
            "id, kind, name, address, latitude, longitude, editorial_note, why_this_one, price_band, family_friendly, submitted_by_creator_id, review_status, active",
          )
          .eq("destination_id", String(dest["id"]))
          .eq("active", true);
        const rows = (placesRes.data ?? []) as Array<Record<string, unknown>>;
        const creatorIds = [
          ...new Set(
            rows
              .map((r) => r["submitted_by_creator_id"])
              .filter((id): id is string => typeof id === "string"),
          ),
        ];
        const creatorsRes = creatorIds.length
          ? await supabase
              .from("creators")
              .select("id, handle, display_name")
              .in("id", creatorIds)
              .eq("status", "approved")
          : { data: [] };
        const creators = new Map(
          ((creatorsRes.data ?? []) as Array<Record<string, unknown>>).map((c) => [
            String(c["id"]),
            { handle: String(c["handle"]), name: String(c["display_name"]) },
          ]),
        );

        for (const r of rows) {
          const kind = String(r["kind"] ?? "");
          if (!isCategory(kind)) continue;
          if (String(r["review_status"] ?? "approved") !== "approved") continue;
          const creatorId = r["submitted_by_creator_id"];
          const creator = typeof creatorId === "string" ? (creators.get(creatorId) ?? null) : null;
          const lat = r["latitude"] == null ? null : Number(r["latitude"]);
          const lon = r["longitude"] == null ? null : Number(r["longitude"]);
          curated.push({
            id: String(r["id"]),
            name: String(r["name"]),
            categories: [kind],
            cuisine: null,
            address: (r["address"] as string | null) ?? null,
            lat,
            lon,
            distanceKm: from && lat != null && lon != null ? distanceKm(from, { lat, lon }) : null,
            website: null,
            phone: null,
            openingHours: null,
            priceBand: (r["price_band"] as string | null) ?? null,
            familyFriendly: Boolean(r["family_friendly"]),
            source: creator ? "creator" : "adair",
            creator,
            note:
              (r["why_this_one"] as string | null) ??
              (r["editorial_note"] as string | null) ??
              null,
          });
        }
      }
    }

    /* ---- public map data around the hotel ---- */
    let mapped: Place[] = [];
    if (from) {
      const { mapPlacesNear } = await import("@/lib/places/osm.server");
      mapped = await mapPlacesNear(supabase, from);
    }

    const pool = [...curated, ...mapped];
    const today = new Date().toISOString().slice(0, 10);
    const sections: PlaceSection[] = [];
    const used = new Set<string>();

    for (const date of days(trip.start_date, trip.end_date)) {
      for (const bucket of bucketsForDay(
        profile.withChildren
          ? { withChildren: true }
          : { withChildren: false, interests: profile.interests },
      )) {
        const categories = categoriesForBucket(
          bucket,
          profile.withChildren
            ? { withChildren: true }
            : { withChildren: false, interests: profile.interests },
        );
        const candidates = pool.filter(
          (place) => !used.has(place.id) && place.categories.some((c) => categories.includes(c)),
        );
        const ranked = rankPlaces(candidates, profile, 4);
        if (!ranked.length) continue;
        ranked.forEach((place) => used.add(place.id));
        sections.push({
          date,
          bucket,
          label: bucketLabel(bucket, date, city || "town", today),
          places: ranked,
        });
      }
    }

    return {
      city,
      attribution: MAP_ATTRIBUTION,
      any: sections.length > 0,
      usesMapData: sections.some((s) => s.places.some((p) => p.source === "map")),
      sections,
    };
  });

/**
 * "Going there" — the traveller tells us they are going, so it lands on the
 * itinerary, in the calendar and in the day-before reminder. No table is
 * claimed: the venue itself knows nothing about it until they call.
 */
export const markGoingThere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        category: z.string().trim().max(40),
        address: z.string().trim().max(200).nullable().optional(),
        website: z.string().trim().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", userId)
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw new Error(trip.error.message);
    if (!trip.data) throw new Error("trip-not-found");

    const res = await supabase.from("trip_items").insert({
      trip_id: data.tripId,
      user_id: userId,
      kind: "restaurant",
      type: "place",
      title: data.name,
      detail: `${data.date} ${data.time} · going there`,
      status: "confirmed",
      amount: 0,
      gross_minor: 0,
      net_minor: 0,
      position: 90,
      payload: {
        reservationAt: `${data.date}T${data.time}`,
        category: data.category,
        address: data.address ?? null,
        website: data.website ?? null,
        booked: false,
      },
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
