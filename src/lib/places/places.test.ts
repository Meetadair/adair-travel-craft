import { describe, expect, it } from "vitest";
import {
  allowedCategories,
  bucketLabel,
  bucketsForDay,
  categoriesForBucket,
} from "./buckets";
import { excluded, rankPlaces, reasonFor, type PlaceProfile } from "./rank";
import { categoriesFromTags } from "./osm.server";
import type { Place } from "./types";

const profile = (over: Partial<PlaceProfile> = {}): PlaceProfile => ({
  cuisines: [],
  diets: [],
  interests: [],
  maxKm: null,
  budgetBand: null,
  dealbreakers: [],
  withChildren: false,
  ...over,
});

const place = (over: Partial<Place>): Place => ({
  id: "x",
  name: "Somewhere",
  categories: ["restaurant"],
  cuisine: null,
  address: null,
  lat: null,
  lon: null,
  distanceKm: null,
  website: null,
  phone: null,
  openingHours: null,
  priceBand: null,
  familyFriendly: false,
  source: "map",
  creator: null,
  note: null,
  ...over,
});

describe("time-of-day bucketing", () => {
  it("puts cafés in the morning and restaurants in the evening", () => {
    expect(categoriesForBucket("morning", { withChildren: false })).toEqual(["cafe"]);
    expect(categoriesForBucket("evening", { withChildren: false })).toEqual(["restaurant"]);
  });

  it("keeps bars, wine bars, cocktail bars and rooftops late", () => {
    expect(categoriesForBucket("late", { withChildren: false })).toEqual([
      "bar",
      "wine_bar",
      "cocktail_bar",
      "rooftop",
    ]);
  });

  it("only offers clubs to someone interested in nightlife", () => {
    expect(categoriesForBucket("night", { withChildren: false })).toEqual([]);
    expect(categoriesForBucket("night", { withChildren: false, interests: ["Nightlife"] })).toEqual([
      "club",
    ]);
    expect(bucketsForDay({ withChildren: false, interests: ["Nightlife"] })).toContain("night");
  });

  it("labels the day relative to today, then by name", () => {
    expect(bucketLabel("evening", "2026-09-13", "Lisbon", "2026-09-13")).toBe("Tonight in Lisbon");
    expect(bucketLabel("morning", "2026-09-14", "Lisbon", "2026-09-13")).toBe(
      "Tomorrow morning in Lisbon",
    );
    expect(bucketLabel("evening", "2026-09-18", "Lisbon", "2026-09-13")).toBe(
      "Friday evening in Lisbon",
    );
  });
});

describe("family exclusion", () => {
  it("removes all nightlife when children are on the trip", () => {
    const allowed = allowedCategories({ withChildren: true, interests: ["Nightlife"] });
    expect(allowed).toEqual(["cafe", "restaurant"]);
    expect(bucketsForDay({ withChildren: true })).toEqual(["morning", "evening"]);
  });

  it("drops a nightlife venue outright rather than ranking it down", () => {
    const bar = place({ id: "b", categories: ["cocktail_bar"] });
    expect(excluded(bar, profile({ withChildren: true }))).toBe(true);
    expect(rankPlaces([bar], profile({ withChildren: true }))).toEqual([]);
  });

  it("keeps a restaurant that also has a bar", () => {
    const both = place({ id: "r", categories: ["restaurant", "bar"] });
    expect(excluded(both, profile({ withChildren: true }))).toBe(false);
  });
});

describe("ranking", () => {
  it("puts curated and creator places above map data", () => {
    const ranked = rankPlaces(
      [
        place({ id: "m", name: "Map place", source: "map" }),
        place({ id: "c", name: "Creator place", source: "creator", creator: { handle: "ana", name: "Ana" } }),
        place({ id: "a", name: "Adair place", source: "adair", note: "Our team ate here" }),
      ],
      profile(),
    );
    expect(ranked.map((p) => p.id)).toEqual(["a", "c", "m"]);
  });

  it("never lets a learned-style boost beat a stated dealbreaker", () => {
    const pick = place({ id: "a", name: "Sushi Bar", source: "adair", note: "great" });
    expect(rankPlaces([pick], profile({ dealbreakers: ["sushi"] }))).toEqual([]);
  });

  it("explains itself in one line", () => {
    const wine = place({ id: "w", categories: ["wine_bar"], distanceKm: 0.4, source: "map" });
    expect(reasonFor(wine, profile({ interests: ["Wine & gastronomy"] }))).toBe(
      "Wine bar, 400 m from your hotel, matches your interest in wine & gastronomy",
    );
  });
});

describe("map tags", () => {
  it("reads categories, not guesses", () => {
    expect(categoriesFromTags({ amenity: "cafe", name: "Copenhagen Coffee" })).toEqual(["cafe"]);
    expect(categoriesFromTags({ amenity: "bar", name: "Rooftop 21" })).toEqual(["bar", "rooftop"]);
    expect(categoriesFromTags({ amenity: "bar", "drink:wine": "yes", name: "Vinho" })).toEqual([
      "bar",
      "wine_bar",
    ]);
    expect(categoriesFromTags({ amenity: "nightclub", name: "Lux" })).toEqual(["club"]);
    expect(categoriesFromTags({ amenity: "pharmacy", name: "Farmácia" })).toEqual([]);
  });
});
