/**
 * Ticketmaster Discovery API — event search only.
 *
 * Discovery is the self-serve tier: apply at developer.ticketmaster.com and
 * an API key arrives immediately, no partner agreement. But it is read-only
 * discovery, not a checkout — there is no order/cart endpoint on this tier.
 * Actually buying a ticket through Ticketmaster's systems needs their gated
 * Partner API (a signed Channel Partner agreement, Distributed Commerce
 * approval), which Adair doesn't have. So this never claims to book a
 * ticket: every result carries Ticketmaster's own event `url`, and that link
 * is the only way to buy. TICKETMASTER_API_KEY unset means the whole feature
 * quietly shows nothing rather than a broken section.
 *
 * Answers are cached for one day (events sell out and reschedule far faster
 * than restaurants move) in the same place_cache table osm.server.ts uses,
 * under a "tm:" key so the two never collide.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripEvent } from "./types";

const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
const CACHE_HOURS = 24;

const apiKey = () => process.env["TICKETMASTER_API_KEY"] ?? "";
export const ticketmasterConfigured = (): boolean => Boolean(apiKey());

type TmPriceRange = { min?: number; max?: number; currency?: string };
type TmVenue = {
  name?: string;
  city?: { name?: string };
  location?: { latitude?: string; longitude?: string };
};
type TmEvent = {
  id?: string;
  name?: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  classifications?: Array<{ segment?: { name?: string } }>;
  priceRanges?: TmPriceRange[];
  images?: Array<{ url?: string; width?: number }>;
  _embedded?: { venues?: TmVenue[] };
};
type TmResponse = { _embedded?: { events?: TmEvent[] } };

const R = 6371;
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

/** A widest promotional image only, never upscaled or guessed. */
export const bestImage = (images: TmEvent["images"]): string | null => {
  if (!images?.length) return null;
  return [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;
};

export function toEvent(raw: TmEvent, from: { lat: number; lon: number } | null): TripEvent | null {
  const id = raw.id;
  const name = raw.name;
  const date = raw.dates?.start?.localDate;
  const url = raw.url;
  if (!id || !name || !date || !url) return null;

  const venue = raw._embedded?.venues?.[0];
  const lat = venue?.location?.latitude ? Number(venue.location.latitude) : null;
  const lon = venue?.location?.longitude ? Number(venue.location.longitude) : null;
  const price = raw.priceRanges?.[0];

  return {
    id,
    name,
    date,
    time: raw.dates?.start?.localTime?.slice(0, 5) ?? null,
    venueName: venue?.name ?? null,
    city: venue?.city?.name ?? null,
    category: raw.classifications?.[0]?.segment?.name ?? null,
    priceFrom: typeof price?.min === "number" ? price.min : null,
    priceTo: typeof price?.max === "number" ? price.max : null,
    currency: price?.currency ?? null,
    distanceKm:
      from && lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
        ? distanceKm(from, { lat, lon })
        : null,
    imageUrl: bestImage(raw.images),
    url,
  };
}

/**
 * Events near a point during a date window. On any failure or missing key
 * this returns an empty list rather than a guess — the section above simply
 * doesn't render.
 */
export async function eventsNear(
  supabase: SupabaseClient,
  point: { lat: number; lon: number },
  dateFrom: string,
  dateTo: string,
  radiusKm = 30,
): Promise<TripEvent[]> {
  if (!apiKey()) return [];

  const key = `tm:${point.lat.toFixed(2)},${point.lon.toFixed(2)}:${dateFrom}:${dateTo}:${radiusKm}`;
  const since = new Date(Date.now() - CACHE_HOURS * 3_600_000).toISOString();

  const cached = await supabase
    .from("place_cache")
    .select("payload, fetched_at")
    .eq("cache_key", key)
    .gte("fetched_at", since)
    .maybeSingle();
  const hit = cached.data as { payload: unknown } | null;
  if (hit && Array.isArray(hit.payload)) return hit.payload as TripEvent[];

  const url = new URL(BASE);
  url.searchParams.set("apikey", apiKey());
  url.searchParams.set("latlong", `${point.lat},${point.lon}`);
  url.searchParams.set("radius", String(radiusKm));
  url.searchParams.set("unit", "km");
  url.searchParams.set("startDateTime", `${dateFrom}T00:00:00Z`);
  url.searchParams.set("endDateTime", `${dateTo}T23:59:59Z`);
  url.searchParams.set("size", "50");
  url.searchParams.set("sort", "date,asc");

  let events: TripEvent[] = [];
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const body = (await res.json()) as TmResponse;
    events = (body._embedded?.events ?? [])
      .map((raw) => toEvent(raw, point))
      .filter((event): event is TripEvent => event !== null);
  } catch {
    return [];
  }

  await supabase
    .from("place_cache")
    .upsert(
      { cache_key: key, payload: events, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

  return events;
}
