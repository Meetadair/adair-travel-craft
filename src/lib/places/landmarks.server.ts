/**
 * Landmarks — what a city is known for, for the trip map.
 *
 * Deliberately separate from the venue categories. A restaurant is something we
 * rank against a traveller's taste; a cathedral is not. Mixing them would mean
 * scoring a museum on whether it serves the right cuisine.
 *
 * Public map data, so no key and no account — and no opening hours, no ticket
 * prices, no availability. The map shows where a thing is. It does not claim
 * the doors are open.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const CACHE_DAYS = 30;

export type LandmarkKind = "museum" | "gallery" | "monument" | "viewpoint" | "park" | "sight";

export type Landmark = {
  /** Stable within a response: "osm:node/123". */
  id: string;
  name: string;
  kind: LandmarkKind;
  lat: number;
  lon: number;
  /** From the reference point, when one is given. */
  distanceKm: number | null;
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

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

/** OSM tags onto the one kind that best describes the place. */
export function kindFromTags(tags: Record<string, string>): LandmarkKind | null {
  const tourism = tags["tourism"] ?? "";
  const historic = tags["historic"] ?? "";
  const leisure = tags["leisure"] ?? "";

  if (tourism === "museum") return "museum";
  if (tourism === "gallery" || tourism === "artwork") return "gallery";
  if (tourism === "viewpoint") return "viewpoint";
  if (leisure === "park" || leisure === "garden") return "park";
  if (historic === "monument" || historic === "memorial" || historic === "castle") {
    return "monument";
  }
  if (tourism === "attraction" || historic) return "sight";
  return null;
}

export const LANDMARK_LABEL: Record<LandmarkKind, string> = {
  museum: "Museum",
  gallery: "Gallery",
  monument: "Monument",
  viewpoint: "View",
  park: "Park",
  sight: "Sight",
};

/**
 * A landmark without a name is a dot nobody can act on, so unnamed features are
 * dropped rather than shown as "unnamed attraction".
 */
function toLandmark(element: Element, from: { lat: number; lon: number }): Landmark | null {
  const tags = element.tags ?? {};
  const name = tags["name"];
  if (!name) return null;

  const kind = kindFromTags(tags);
  if (!kind) return null;

  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  return {
    id: `osm:${element.type}/${element.id}`,
    name,
    kind,
    lat,
    lon,
    distanceKm: distanceKm(from, { lat, lon }),
  };
}

function query(lat: number, lon: number, radius: number): string {
  const around = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:25];
(
  node["tourism"~"^(museum|gallery|artwork|viewpoint|attraction)$"]${around};
  way["tourism"~"^(museum|gallery|attraction)$"]${around};
  node["historic"~"^(monument|memorial|castle)$"]${around};
  way["historic"~"^(monument|memorial|castle)$"]${around};
  way["leisure"~"^(park|garden)$"]${around};
);
out tags center 150;`;
}

/**
 * Landmarks around a point. Cached for a month — a cathedral does not move.
 * On any failure we return an empty list rather than a guess.
 */
export async function landmarksNear(
  supabase: SupabaseClient,
  point: { lat: number; lon: number },
  radiusMetres = 3000,
  limit = 12,
): Promise<Landmark[]> {
  const key = `osm-landmarks:${point.lat.toFixed(3)},${point.lon.toFixed(3)}:${radiusMetres}`;
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();

  const cached = await supabase
    .from("place_cache")
    .select("payload, fetched_at")
    .eq("cache_key", key)
    .gte("fetched_at", since)
    .maybeSingle();
  const hit = cached.data as { payload: unknown } | null;
  if (hit && Array.isArray(hit.payload)) return (hit.payload as Landmark[]).slice(0, limit);

  let elements: Element[] = [];
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query(point.lat, point.lon, radiusMetres))}`,
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { elements?: Element[] };
    elements = json.elements ?? [];
  } catch {
    return [];
  }

  const landmarks = elements
    .map((element) => toLandmark(element, point))
    .filter((entry): entry is Landmark => entry !== null)
    // Nearest first: what is walkable from the hotel matters more than what is famous.
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  // Cache the full set; the caller decides how many to show.
  await supabase
    .from("place_cache")
    .upsert(
      { cache_key: key, payload: landmarks, fetched_at: new Date().toISOString() },
      { onConflict: "cache_key" },
    );

  return landmarks.slice(0, limit);
}
