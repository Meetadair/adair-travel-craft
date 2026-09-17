/**
 * Ordering and the one-line reason under each place.
 *
 * Rules, in order: curated and creator entries always beat map data; then how
 * well the place matches what the traveller actually said they like; then how
 * far it is from their hotel. A stated dealbreaker removes a place — it is
 * never merely ranked down.
 */
import { isNightlife, type Company } from "./buckets";
import { CATEGORY_LABEL, type Place, type PlaceCategory, type RankedPlace } from "./types";

export type PlaceProfile = {
  cuisines: string[];
  diets: string[];
  interests: string[];
  /** Walking distance they accept from the hotel, in km. */
  maxKm: number | null;
  budgetBand: string | null;
  dealbreakers: string[];
  withChildren: boolean;
};

const lower = (values: string[]) => values.map((v) => v.toLowerCase());

const SOURCE_SCORE = { adair: 1000, creator: 900, map: 0 } as const;

const INTEREST_FOR: Partial<Record<PlaceCategory, string[]>> = {
  wine_bar: ["wine", "gastronomy"],
  cocktail_bar: ["nightlife", "cocktail"],
  club: ["nightlife", "live music", "music"],
  rooftop: ["nightlife", "views", "design"],
  restaurant: ["gastronomy", "food"],
  cafe: ["coffee", "slow", "design"],
};

const cuisineHit = (place: Place, profile: PlaceProfile): string | null => {
  if (!place.cuisine) return null;
  const cuisine = place.cuisine.toLowerCase();
  return lower(profile.cuisines).find((c) => cuisine.includes(c) || c.includes(cuisine)) ?? null;
};

const interestHit = (place: Place, profile: PlaceProfile): string | null => {
  const interests = lower(profile.interests);
  for (const category of place.categories) {
    for (const tag of INTEREST_FOR[category] ?? []) {
      const found = interests.find((i) => i.includes(tag));
      if (found) return found;
    }
  }
  return null;
};

/** A dealbreaker in their own words knocks the place out entirely. */
export function excluded(place: Place, profile: PlaceProfile): boolean {
  if (profile.withChildren && place.categories.every(isNightlife)) return true;
  const haystack = [place.name, place.cuisine ?? "", place.note ?? "", ...place.categories]
    .join(" ")
    .toLowerCase();
  return lower(profile.dealbreakers).some((word) => word.length > 2 && haystack.includes(word));
}

const near = (place: Place, profile: PlaceProfile): boolean =>
  place.distanceKm != null && profile.maxKm != null && place.distanceKm <= profile.maxKm;

export function scoreOf(place: Place, profile: PlaceProfile): number {
  let score = SOURCE_SCORE[place.source];
  if (cuisineHit(place, profile)) score += 60;
  if (interestHit(place, profile)) score += 40;
  if (place.note) score += 20;
  if (profile.withChildren && place.familyFriendly) score += 40;
  if (place.distanceKm != null) score += Math.max(0, 30 - place.distanceKm * 10);
  if (near(place, profile)) score += 15;
  if (place.priceBand && profile.budgetBand && place.priceBand === profile.budgetBand) score += 10;
  return Math.round(score);
}

const metres = (km: number): string =>
  km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`;

/** One plain sentence: what it is, how far, and why it is on this list. */
export function reasonFor(place: Place, profile: PlaceProfile): string {
  const kind = CATEGORY_LABEL[place.categories[0] ?? "restaurant"];
  const where = place.distanceKm != null ? `${metres(place.distanceKm)} from your hotel` : null;
  const cuisine = cuisineHit(place, profile);
  const interest = interestHit(place, profile);

  const why = place.creator
    ? `recommended by ${place.creator.name}`
    : place.source === "adair" && place.note
      ? "written up by our team"
      : cuisine
        ? `matches your taste for ${cuisine}`
        : interest
          ? `matches your interest in ${interest}`
          : profile.withChildren && place.familyFriendly
            ? "welcomes children"
            : null;

  return [kind, where, why]
    .filter(Boolean)
    .join(", ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Rank one bucket's worth of places, dropping anything excluded. */
export function rankPlaces(places: Place[], profile: PlaceProfile, limit = 4): RankedPlace[] {
  return places
    .filter((place) => !excluded(place, profile))
    .map((place) => ({
      ...place,
      score: scoreOf(place, profile),
      reason: reasonFor(place, profile),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type { Company };
