/**
 * Public map data through the Overpass API — same free, key-less source
 * src/lib/places/osm.server.ts uses for restaurants and bars. No prices, no
 * stock, no guarantee a place is still there; we say so in the UI rather
 * than filling the gap in.
 *
 * Answers are cached for seven days under a "shop:" key so this never
 * collides with the "osm:" places cache or the "tm:" events cache in the
 * same place_cache table.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shop, ShopCategory } from "./types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_DAYS = 7;

/** Tags worth showing a traveller — not a grocery run. */
const SHOP_TAGS = [
  "mall",
  "department_store",
  "variety_store",
  "clothes",
  "shoes",
  "jewelry",
  "bag",
  "watches",
  "cosmetics",
  "leather",
  "gift",
  "toys",
  "books",
  "art",
  "antiques",
  "craft",
  "second_hand",
];

const CATEGORY_OF: Record<string, ShopCategory> = {
  mall: "mall",
  department_store: "mall",
  variety_store: "market",
  clothes: "boutique",
  shoes: "boutique",
  jewelry: "boutique",
  bag: "boutique",
  watches: "boutique",
  cosmetics: "boutique",
  leather: "boutique",
  gift: "gifts",
  toys: "gifts",
  books: "books_art",
  art: "books_art",
  antiques: "books_art",
  craft: "books_art",
  second_hand: "books_art",
};

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

export function categoryFromTags(tags: Record<string, string>): ShopCategory | null {
  if (tags["amenity"] === "marketplace") return "market";
  const shop = tags["shop"] ?? "";
  return CATEGORY_OF[shop] ?? null;
}

export function toShop(element: Element, from: { lat: number; lon: number }): Shop | null {
  const tags = element.tags ?? {};
  const name = tags["name"];
  if (!name) return null;
  const category = categoryFromTags(tags);
  if (!category) return null;
  const lat = element.lat ?? element.center?.lat ?? null;
  const lon = element.lon ?? element.center?.lon ?? null;

  return {
    id: `osm:${element.type}/${element.id}`,
    name,
    category,
    address:
      [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ").trim() || null,
    lat,
    lon,
    distanceKm:
      lat != null && lon != null
        ? Math.round(distance(from.lat, from.lon, lat, lon) * 100) / 100
        : null,
    website: tags["website"] ?? tags["contact:website"] ?? null,
    phone: tags["phone"] ?? tags["contact:phone"] ?? null,
    openingHours: tags["opening_hours"] ?? null,
  };
}

const query = (lat: number, lon: number, radius: number) => `[out:json][timeout:25];
(
  node["shop"~"^(${SHOP_TAGS.join("|")})$"](around:${radius},${lat},${lon});
  way["shop"~"^(${SHOP_TAGS.join("|")})$"](around:${radius},${lat},${lon});
  node["amenity"="marketplace"](around:${radius},${lat},${lon});
  way["amenity"="marketplace"](around:${radius},${lat},${lon});
);
out tags center 120;`;

/**
 * Shops around a point. Cached per rounded coordinate + radius; on any
 * failure we return an empty list rather than a guess.
 */
export async function shopsNear(
  supabase: SupabaseClient,
  point: { lat: number; lon: number },
  radiusMetres = 2000,
): Promise<Shop[]> {
  const key = `shop:${point.lat.toFixed(3)},${point.lon.toFixed(3)}:${radiusMetres}`;
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();

  const cached = await supabase
    .from("place_cache")
    .select("payload, fetched_at")
    .eq("cache_key", key)
    .gte("fetched_at", since)
    .maybeSingle();
  const hit = cached.data as { payload: unknown } | null;
  if (hit && Array.isArray(hit.payload)) return hit.payload as Shop[];

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

  const shops = elements
    .map((element) => toShop(element, point))
    .filter((shop): shop is Shop => shop !== null);

  await supabase
    .from("place_cache")
    .upsert(
      { cache_key: key, payload: shops, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

  return shops;
}
