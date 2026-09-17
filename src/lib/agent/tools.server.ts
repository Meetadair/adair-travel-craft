/**
 * Running the tools.
 *
 * Each executor wraps a library that already exists — map places, curated
 * entries, geo distance, traveller memory — and returns a compact JSON string.
 * Failures never throw into the loop: they come back as an honest `ok: false`
 * so Adair can say it does not know instead of inventing an answer.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { mapPlacesNear } from "@/lib/places/osm.server";
import { MAP_ATTRIBUTION, type Place, type PlaceCategory } from "@/lib/places/types";
import { findCity } from "@/lib/trip/cities";
import { originClause, resolveLocation, type LocationInputs } from "./location";
import { loadPatterns, loadPlaceMemory } from "@/lib/trip/memory.server";
import { eventsNear, ticketmasterConfigured } from "@/lib/events/ticketmaster.server";
import {
  currentLocationInput,
  distanceAndTimeInput,
  findPlacesInput,
  getCuratedInput,
  getEventsInput,
  travelMinutes,
  travellerContextInput,
  toolFailure,
  type ToolName,
} from "./tools";

const R = 6371;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export type ToolContext = {
  supabase: SupabaseClient;
  userId: string;
  /** Where the traveller is, resolved per request and never stored. */
  location?: LocationInputs;
  /** The open trip's own dates, when there is one — the default event window. */
  tripDates?: { start: string; end: string } | null;
  /** "YYYY-MM-DD", used when a tool needs "today" and the trip has no dates. */
  today?: string;
};

/* ------------------------------------------------------------ find_places */

async function findPlaces(input: unknown, ctx: ToolContext): Promise<string> {
  const parsed = findPlacesInput.safeParse(input);
  if (!parsed.success) return toolFailure("find_places", "bad-input");
  const { city, category, near, radiusMetres, limit } = parsed.data;

  const point = near ?? cityPoint(city);
  if (!point) return toolFailure("find_places", `no coordinates on file for ${city}`);

  let places: Place[] = [];
  try {
    places = await mapPlacesNear(ctx.supabase, point, radiusMetres);
  } catch {
    return toolFailure("find_places", "map data unavailable");
  }

  const filtered = category
    ? places.filter((p) => p.categories.includes(category as PlaceCategory))
    : places;

  // A venue with no coordinates cannot be placed on a map or measured, so it
  // is not something we can honestly offer.
  const located = filtered.filter(
    (p): p is Place & { lat: number; lon: number } => p.lat !== null && p.lon !== null,
  );

  const results = located.slice(0, limit).map((p) => ({
    name: p.name,
    categories: p.categories,
    lat: p.lat,
    lon: p.lon,
    distanceKm: near ? haversineKm(near, { lat: p.lat, lon: p.lon }) : null,
    source: "map",
  }));

  return JSON.stringify({
    tool: "find_places",
    ok: true,
    city,
    attribution: MAP_ATTRIBUTION,
    note: "Map data only. No opening hours, prices or availability — do not state any.",
    results,
  });
}

/** Coordinates for a city we already carry, so the tool works without a card. */
function cityPoint(city: string): { lat: number; lon: number } | null {
  const entry = findCity(city);
  if (!entry) return null;
  const lat = (entry as unknown as { lat?: number }).lat;
  const lon = (entry as unknown as { lon?: number }).lon;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : null;
}

/* ------------------------------------------------------------ get_curated */

async function getCurated(input: unknown, ctx: ToolContext): Promise<string> {
  const parsed = getCuratedInput.safeParse(input);
  if (!parsed.success) return toolFailure("get_curated", "bad-input");
  const { city, kind, familyFriendly, limit } = parsed.data;

  const destRes = await ctx.supabase
    .from("getaway_destinations")
    .select("id, name, latitude, longitude")
    .ilike("name", city)
    .limit(1);
  const dest = ((destRes.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
  if (!dest) return toolFailure("get_curated", `nothing written up for ${city} yet`);

  let query = ctx.supabase
    .from("getaway_places")
    .select(
      "id, kind, name, address, latitude, longitude, editorial_note, why_this_one, price_band, family_friendly, submitted_by_creator_id",
    )
    .eq("destination_id", String(dest["id"]))
    .eq("active", true);
  if (kind) query = query.eq("kind", kind);
  if (familyFriendly === true) query = query.eq("family_friendly", true);

  const placesRes = await query.limit(limit);
  const rows = (placesRes.data ?? []) as Array<Record<string, unknown>>;
  if (!rows.length) return toolFailure("get_curated", `nothing written up for ${city} yet`);

  // Creator recommendations must carry the creator's name when they are used.
  const creatorIds = [
    ...new Set(
      rows
        .map((r) => r["submitted_by_creator_id"])
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const creators = new Map<string, string>();
  if (creatorIds.length) {
    const res = await ctx.supabase
      .from("creators")
      .select("id, handle, display_name")
      .in("id", creatorIds);
    for (const row of (res.data ?? []) as Array<Record<string, unknown>>) {
      creators.set(
        String(row["id"]),
        String(row["display_name"] ?? row["handle"] ?? "an Adair contributor"),
      );
    }
  }

  const results = rows.map((r) => {
    const creatorId = r["submitted_by_creator_id"];
    return {
      name: String(r["name"] ?? ""),
      kind: r["kind"] ?? null,
      address: r["address"] ?? null,
      lat: r["latitude"] ?? null,
      lon: r["longitude"] ?? null,
      note: r["editorial_note"] ?? null,
      whyThisOne: r["why_this_one"] ?? null,
      priceBand: r["price_band"] ?? null,
      familyFriendly: r["family_friendly"] ?? null,
      attribution: typeof creatorId === "string" ? (creators.get(creatorId) ?? null) : "Adair",
    };
  });

  return JSON.stringify({ tool: "get_curated", ok: true, city, results });
}

/* -------------------------------------------------------------- get_events */

async function getEvents(input: unknown, ctx: ToolContext): Promise<string> {
  const parsed = getEventsInput.safeParse(input);
  if (!parsed.success) return toolFailure("get_events", "bad-input");
  const { city, near, dateFrom, dateTo, limit } = parsed.data;

  if (!ticketmasterConfigured()) return toolFailure("get_events", "events lookup not configured");

  const point = near ?? ctx.location?.hotel ?? ctx.location?.city ?? cityPoint(city);
  if (!point) return toolFailure("get_events", `no coordinates on file for ${city}`);

  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const from = dateFrom ?? ctx.tripDates?.start ?? today;
  const to =
    dateTo ??
    ctx.tripDates?.end ??
    new Date(new Date(from).getTime() + 30 * 86_400_000).toISOString().slice(0, 10);

  let events;
  try {
    events = await eventsNear(ctx.supabase, point, from, to);
  } catch {
    return toolFailure("get_events", "events lookup unavailable");
  }

  return JSON.stringify({
    tool: "get_events",
    ok: true,
    city,
    dateFrom: from,
    dateTo: to,
    note: "Ticketmaster's own listing. Every result links to their page to buy — never say you booked or held one.",
    results: events.slice(0, limit).map((e) => ({
      name: e.name,
      date: e.date,
      time: e.time,
      venueName: e.venueName,
      category: e.category,
      priceFrom: e.priceFrom,
      priceTo: e.priceTo,
      currency: e.currency,
      distanceKm: e.distanceKm,
      url: e.url,
    })),
  });
}

/* ------------------------------------------------------ distance_and_time */

function distanceAndTime(input: unknown): string {
  const parsed = distanceAndTimeInput.safeParse(input);
  if (!parsed.success) return toolFailure("distance_and_time", "bad-input");
  const { from, to } = parsed.data;

  const km = haversineKm(from, to);
  const { walking, driving } = travelMinutes(km);

  return JSON.stringify({
    tool: "distance_and_time",
    ok: true,
    from: from.label || null,
    to: to.label || null,
    straightLineKm: km,
    walkingMinutes: walking,
    drivingMinutes: driving,
    note: "Straight line, not a routed direction. Present as approximate.",
  });
}

/* -------------------------------------------------- get_traveller_context */

async function travellerContext(input: unknown, ctx: ToolContext): Promise<string> {
  const parsed = travellerContextInput.safeParse(input);
  if (!parsed.success) return toolFailure("get_traveller_context", "bad-input");
  const { city } = parsed.data;

  const prefsRes = await ctx.supabase
    .from("preferences")
    .select(
      "cuisines, diets, interests, hotel_max_km, budget_band, dealbreakers, trip_purpose, cabin_class",
    )
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const row = (prefsRes.data ?? null) as Record<string, unknown> | null;

  const [memory, patterns] = await Promise.all([
    loadPlaceMemory(ctx.supabase, ctx.userId)
      .then((rows) =>
        city ? rows.filter((r) => r.place.toLowerCase() === city.toLowerCase()) : rows,
      )
      .catch(() => null),
    loadPatterns(ctx.supabase, ctx.userId).catch(() => null),
  ]);

  return JSON.stringify({
    tool: "get_traveller_context",
    ok: true,
    stated: {
      cuisines: list(row?.["cuisines"]),
      diets: list(row?.["diets"]),
      interests: list(row?.["interests"]),
      budgetBand: row?.["budget_band"] ?? null,
      maxKmFromCentre: row?.["hotel_max_km"] ?? null,
      cabinClass: row?.["cabin_class"] ?? null,
      tripPurpose: list(row?.["trip_purpose"]),
    },
    dealbreakers: list(row?.["dealbreakers"]),
    placeMemory: memory,
    learnedPatterns: patterns,
    note: "Dealbreakers are absolute. Learned patterns are suggestions, not decisions.",
  });
}

/* ------------------------------------------------- get_current_location */

function currentLocation(input: unknown, ctx: ToolContext): string {
  const parsed = currentLocationInput.safeParse(input);
  if (!parsed.success) return toolFailure("get_current_location", "bad-input");

  const inputs: LocationInputs = ctx.location ?? {
    device: null,
    consent: "not_asked",
    hotel: null,
    city: null,
  };
  const resolved = resolveLocation(inputs, parsed.data.precise);

  if (resolved.source === "none") {
    return JSON.stringify({
      tool: "get_current_location",
      ok: false,
      reason: "no starting point on file — ask where they are setting off from",
      source: "none",
      askConsent: resolved.askConsent,
      consent: resolved.consent,
      results: [],
    });
  }

  return JSON.stringify({
    tool: "get_current_location",
    ok: true,
    source: resolved.source,
    label: resolved.label,
    lat: resolved.lat,
    lon: resolved.lon,
    consent: resolved.consent,
    askConsent: resolved.askConsent,
    say: originClause(resolved),
    note:
      resolved.source === "device"
        ? "Exact position, used for this answer only and not kept."
        : "Not their exact position. Name the starting point you used in the answer.",
  });
}

/* ------------------------------------------------------------- dispatcher */

export async function runTool(name: ToolName, input: unknown, ctx: ToolContext): Promise<string> {
  try {
    switch (name) {
      case "find_places":
        return await findPlaces(input, ctx);
      case "get_curated":
        return await getCurated(input, ctx);
      case "get_events":
        return await getEvents(input, ctx);
      case "distance_and_time":
        return distanceAndTime(input);
      case "get_traveller_context":
        return await travellerContext(input, ctx);
      case "get_current_location":
        return currentLocation(input, ctx);
      default:
        return toolFailure(name, "unknown tool");
    }
  } catch (error) {
    console.error("Tool failed", name, error);
    return toolFailure(name, "tool failed");
  }
}

export { haversineKm };
