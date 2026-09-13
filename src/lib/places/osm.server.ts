/**
 * Public map data through the Overpass API. No key, no account, so it is
 * always available — but it carries no prices and no availability, and we say
 * so rather than filling the gap in.
 *
 * Answers are cached for seven days so a trip page never hammers Overpass.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Place, PlaceCategory } from "./types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_DAYS = 7;

type Element = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const R = 6371;

function distance(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Map OSM tags onto our categories. A place can be more than one thing. */
export function categoriesFromTags(tags: Record<string, string>): PlaceCategory[] {
  const amenity = tags["amenity"] ?? "";
  const text = [tags["name"], tags["drink:wine"], tags["cuisine"], tags["bar"], tags["description"]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const out = new Set<PlaceCategory>();

  if (amenity === "restaurant") out.add("restaurant");
  if (amenity === "cafe") out.add("cafe");
  if (amenity === "nightclub") out.add("club");
  if (amenity === "bar" || amenity === "pub") out.add("bar");

  if (tags["drink:wine"] === "yes" || text.includes("wine") || tags["cuisine"] === "wine")
    out.add("wine_bar");
  if (text.includes("cocktail") || tags["drink:cocktail"] === "yes") out.add("cocktail_bar");
  if (text.includes("rooftop") || tags["location"] === "roof") out.add("rooftop");

  return [...out];
}

const cuisineOf = (tags: Record<string, string>): string | null =>
  tags["cuisine"] ? tags["cuisine"].split(";")[0]!.replace(/_/g, " ") : null;

function toPlace(element: Element, from: { lat: number; lon: number }): Place | null {
  const tags = element.tags ?? {};
  const name = tags["name"];
  if (!name) return null;
  const categories = categoriesFromTags(tags);
  if (!categories.length) return null;
  const lat = element.lat ?? element.center?.lat ?? null;
  const lon = element.lon ?? element.center?.lon ?? null;

  return {
    id: `osm:${element.type}/${element.id}`,
    name,
    categories,
    cuisine: cuisineOf(tags),
    address:
      [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ").trim() || null,
    lat,
    lon,
    distanceKm:
      lat != null && lon != null ? Math.round(distance(from.lat, from.lon, lat, lon) * 100) / 100 : null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
    openingHours: tags["opening_hours"] ?? null,
    priceBand: null,
    familyFriendly: tags["kids_area"] === "yes" || tags["children"] === "yes",
    source: "map",
    creator: null,
    note: null,
  };
}

const query = (lat: number, lon: number, radius: number) => `[out:json][timeout:25];
(
  node["amenity"~"^(restaurant|bar|pub|cafe|nightclub)$"](around:${radius},${lat},${lon});
  way["amenity"~"^(restaurant|bar|pub|cafe|nightclub)$"](around:${radius},${lat},${lon});
);
out tags center 120;`;

/**
 * Venues around a point. Cached per rounded coordinate + radius; on any
 * failure we return an empty list rather than a guess.
 */
export async function mapPlacesNear(
  supabase: SupabaseClient,
  point: { lat: number; lon: number },
  radiusMetres = 2000,
): Promise<Place[]> {
  const key = `osm:${point.lat.toFixed(3)},${point.lon.toFixed(3)}:${radiusMetres}`;
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();

  const cached = await supabase
    .from("place_cache")
    .select("payload, fetched_at")
    .eq("cache_key", key)
    .gte("fetched_at", since)
    .maybeSingle();
  const hit = cached.data as { payload: unknown } | null;
  if (hit && Array.isArray(hit.payload)) return hit.payload as Place[];

  let elements: Element[] = [];
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query(point.lat, point.lon, radiusMetres))}`,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { elements?: Element[] };
    elements = body.elements ?? [];
  } catch {
    return [];
  }

  const places = elements
    .map((element) => toPlace(element, point))
    .filter((place): place is Place => place !== null);

  await supabase
    .from("place_cache")
    .upsert(
      { cache_key: key, payload: places, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

  return places;
}
