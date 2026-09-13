/**
 * "Places to go out" on a trip: restaurants, cafés, bars, wine and cocktail
 * bars, rooftops and clubs.
 *
 * Two sources only — places the team (or a creator partner) has actually
 * written up, and public map data. Nothing here is invented: no price we do
 * not know, no availability we have not been told.
 */

export type PlaceCategory =
  | "restaurant"
  | "cafe"
  | "bar"
  | "wine_bar"
  | "cocktail_bar"
  | "rooftop"
  | "club";

export const PLACE_CATEGORIES: PlaceCategory[] = [
  "restaurant",
  "cafe",
  "bar",
  "wine_bar",
  "cocktail_bar",
  "rooftop",
  "club",
];

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  wine_bar: "Wine bar",
  cocktail_bar: "Cocktail bar",
  rooftop: "Rooftop",
  club: "Club",
};

/** Where the entry came from. Curated and creator entries outrank map data. */
export type PlaceSource = "adair" | "creator" | "map";

export const SOURCE_LABEL: Record<PlaceSource, string> = {
  adair: "Adair pick",
  creator: "Creator partner",
  map: "from OpenStreetMap",
};

export const MAP_ATTRIBUTION = "Map data © OpenStreetMap contributors";

export type Place = {
  /** Stable within one response: curated row id, or "osm:node/123". */
  id: string;
  name: string;
  categories: PlaceCategory[];
  cuisine: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  /** From the hotel, when we know both ends. */
  distanceKm: number | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
  priceBand: string | null;
  familyFriendly: boolean;
  source: PlaceSource;
  /** Set when a creator partner recommended it. */
  creator: { handle: string; name: string } | null;
  /** The team's or the creator's own words, when they wrote any. */
  note: string | null;
};

/** A place plus the one line explaining why it is being shown. */
export type RankedPlace = Place & { reason: string; score: number };
