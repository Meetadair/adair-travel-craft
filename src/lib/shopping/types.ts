/**
 * "Shopping near your hotel" — public map data only, no prices, no stock, no
 * opening-hours guarantee. We show what OpenStreetMap has tagged near the
 * hotel and say plainly that it can be out of date.
 */

export type ShopCategory = "mall" | "market" | "boutique" | "gifts" | "books_art";

export const SHOP_CATEGORY_LABEL: Record<ShopCategory, string> = {
  mall: "Mall / department store",
  market: "Market",
  boutique: "Boutique",
  gifts: "Gifts & souvenirs",
  books_art: "Books & art",
};

export type Shop = {
  /** "osm:node/123" or "osm:way/123" — stable within one response. */
  id: string;
  name: string;
  category: ShopCategory;
  address: string | null;
  lat: number | null;
  lon: number | null;
  /** From the hotel, when we know both ends. */
  distanceKm: number | null;
  website: string | null;
  phone: string | null;
  openingHours: string | null;
};

export const MAP_ATTRIBUTION = "Map data © OpenStreetMap contributors";
