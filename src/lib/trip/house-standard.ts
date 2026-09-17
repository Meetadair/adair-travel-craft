/**
 * The floor Adair will not go below, whatever anybody answered.
 *
 * Preferences say what a traveller likes. This says what we are willing to put
 * our name on — and it is not a question in the questionnaire, because a person
 * who has never used Adair cannot be asked to specify the quality of a company
 * they do not know yet. They judge us by the first hotel we show them.
 *
 * Four stars is the floor. Above it, the properties that carry what makes a
 * stay worth remembering — a spa, a pool, water, mountains, a stable, a golf
 * course, or the fact that somebody designed the place rather than rolled it
 * out — are lifted above properties that merely have a bed and a good price.
 *
 * The floor is a floor, never a wall: if a town on a Tuesday has nothing at
 * four stars, we show the best it has and say so, rather than returning an
 * empty page and calling it standards.
 */
import type { StayResult } from "@/lib/trip/types";

/** Below this, we do not offer it unless the destination has nothing else. */
export const HOUSE_MIN_RATING = 4;

/**
 * What lifts a property. The words are matched against the name and against the
 * amenity list the supplier publishes, because a hotel called "Thermal & Spa"
 * and a hotel listing "spa" in its facilities are the same promise.
 */
export const HOUSE_QUALITIES: Record<string, string[]> = {
  spa: ["spa", "thermal", "thermae", "terme", "wellness", "hammam", "onsen"],
  pool: ["pool", "piscine", "piscina", "swimming"],
  boutique: [
    "boutique",
    "design hotel",
    "relais",
    "manor",
    "château",
    "chateau",
    "palazzo",
    "villa",
  ],
  beach: ["beach", "beachfront", "seafront", "playa", "plage", "spiaggia", "oceanfront"],
  lake: ["lake", "lakeside", "lago", "see ", "lakefront"],
  mountains: ["mountain", "alpine", "alpen", "ski", "dolomit", "berg", "peak"],
  golf: ["golf", "links", "fairway"],
  horses: ["equestrian", "riding", "stable", "horse", "ranch"],
};

const fold = (value: string): string => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Which of the house qualities this property actually carries. */
export function houseQualities(name: string, amenities?: string[]): string[] {
  const hay = fold([name, ...(amenities ?? [])].join(" "));
  const found: string[] = [];
  for (const [quality, words] of Object.entries(HOUSE_QUALITIES)) {
    if (words.some((word) => hay.includes(fold(word)))) found.push(quality);
  }
  return found;
}

/**
 * The bonus a property earns for carrying them, added to the ranking score.
 *
 * Capped on purpose: three of these make a place special, eight make it a
 * resort brochure, and we are not ranking brochures.
 */
export function houseBonus(name: string, amenities?: string[]): number {
  return Math.min(houseQualities(name, amenities).length, 3) * 2;
}

export type HouseFiltered = {
  stays: StayResult[];
  /**
   * True when the floor had to be dropped because the destination has nothing
   * above it. The card says so rather than pretending this is our standard.
   */
  relaxed: boolean;
};

/**
 * Apply the floor. Keeps only properties at or above four, unless that leaves
 * nothing — in which case everything comes back, flagged, so the traveller is
 * told plainly instead of being shown an empty result.
 *
 * A property whose rating the supplier does not publish is kept: an unrated
 * small hotel is a gap in the data, not evidence of a bad hotel.
 */
export function applyHouseStandard(stays: StayResult[]): HouseFiltered {
  if (!stays.length) return { stays, relaxed: false };
  const meets = stays.filter((s) => s.rating == null || s.rating >= HOUSE_MIN_RATING);
  if (meets.length) return { stays: meets, relaxed: false };
  return { stays, relaxed: true };
}
