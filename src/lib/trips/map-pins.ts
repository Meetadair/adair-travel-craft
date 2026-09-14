/**
 * The pins on a trip map.
 *
 * One place to decide what appears, in what order, and in what colour — so the
 * map component only draws and this stays testable.
 *
 * The hotel is the anchor: everything else is measured from it, and if we do
 * not know where it is there is no map worth drawing. A meeting the traveller
 * told us about outranks everything we chose for them.
 */
import type { Landmark } from "@/lib/places/landmarks.server";
import type { RankedPlace } from "@/lib/places/types";

export type PinKind = "hotel" | "meeting" | "eat" | "drink" | "see";

export type MapPin = {
  id: string;
  kind: PinKind;
  name: string;
  lat: number;
  lon: number;
  /** One short line under the name in the popup. */
  detail: string | null;
  /** Straight-line distance from the hotel, in km. Null on the hotel itself. */
  distanceKm: number | null;
};

/** Coral for what they booked, quieter tones for what we suggest. */
export const PIN_COLOUR: Record<PinKind, string> = {
  hotel: "#E8623F",
  meeting: "#1C1A17",
  eat: "#8A6A4F",
  drink: "#6E6861",
  see: "#4A6B5E",
};

export const PIN_LABEL: Record<PinKind, string> = {
  hotel: "Your hotel",
  meeting: "Your meeting",
  eat: "Places to eat",
  drink: "Places to drink",
  see: "Worth seeing",
};

/** The order pins are drawn and listed in: booked first, then suggested. */
export const PIN_ORDER: PinKind[] = ["hotel", "meeting", "eat", "drink", "see"];

const R = 6371;

export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
}

const DRINK_CATEGORIES = new Set(["bar", "wine_bar", "cocktail_bar", "rooftop", "club"]);

export type PinSources = {
  hotel: { name: string; lat: number | null | undefined; lon: number | null | undefined } | null;
  meeting: { label: string; lat: number; lon: number } | null;
  places: RankedPlace[];
  landmarks: Landmark[];
  /** Keeps the map readable; the list below it can be longer. */
  maxPlaces?: number;
  maxLandmarks?: number;
};

export function buildPins(sources: PinSources): MapPin[] {
  const { hotel, meeting, places, landmarks } = sources;
  const maxPlaces = sources.maxPlaces ?? 8;
  const maxLandmarks = sources.maxLandmarks ?? 8;

  const anchor =
    hotel && typeof hotel.lat === "number" && typeof hotel.lon === "number"
      ? { lat: hotel.lat, lon: hotel.lon }
      : null;

  const pins: MapPin[] = [];

  if (hotel && anchor) {
    pins.push({
      id: "hotel",
      kind: "hotel",
      name: hotel.name,
      lat: anchor.lat,
      lon: anchor.lon,
      detail: null,
      distanceKm: null,
    });
  }

  if (meeting) {
    pins.push({
      id: "meeting",
      kind: "meeting",
      name: meeting.label,
      lat: meeting.lat,
      lon: meeting.lon,
      detail: null,
      distanceKm: anchor ? distanceKm(anchor, meeting) : null,
    });
  }

  const seen = new Set<string>();
  const located = places.filter(
    (place): place is RankedPlace & { lat: number; lon: number } =>
      typeof place.lat === "number" && typeof place.lon === "number",
  );

  for (const place of located.slice(0, maxPlaces)) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    const drinks = place.categories.some((category) => DRINK_CATEGORIES.has(category));
    pins.push({
      id: place.id,
      kind: drinks ? "drink" : "eat",
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      detail: place.reason || place.cuisine,
      distanceKm: place.distanceKm ?? (anchor ? distanceKm(anchor, place) : null),
    });
  }

  for (const landmark of landmarks.slice(0, maxLandmarks)) {
    if (seen.has(landmark.id)) continue;
    seen.add(landmark.id);
    pins.push({
      id: landmark.id,
      kind: "see",
      name: landmark.name,
      lat: landmark.lat,
      lon: landmark.lon,
      detail: null,
      distanceKm: landmark.distanceKm ?? (anchor ? distanceKm(anchor, landmark) : null),
    });
  }

  return pins;
}

/** Grouped for the legend and the list, in a fixed order, empty kinds dropped. */
export function groupPins(pins: MapPin[]): Array<{ kind: PinKind; pins: MapPin[] }> {
  return PIN_ORDER.map((kind) => ({ kind, pins: pins.filter((pin) => pin.kind === kind) })).filter(
    (group) => group.pins.length > 0,
  );
}

/** What the map should frame. Null when there is nothing worth drawing. */
export function boundsOf(pins: MapPin[]): {
  south: number;
  west: number;
  north: number;
  east: number;
} | null {
  if (!pins.length) return null;
  const lats = pins.map((pin) => pin.lat);
  const lons = pins.map((pin) => pin.lon);
  return {
    south: Math.min(...lats),
    west: Math.min(...lons),
    north: Math.max(...lats),
    east: Math.max(...lons),
  };
}
