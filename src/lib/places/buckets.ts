/**
 * Time-of-day grouping. A trip day is not one flat list of venues: coffee in
 * the morning, dinner in the evening, a drink after it, a club only if that is
 * what this traveller is into.
 */
import type { PlaceCategory } from "./types";

export type Bucket = "morning" | "evening" | "late" | "night";

export const BUCKETS: Bucket[] = ["morning", "evening", "late", "night"];

export const BUCKET_CATEGORIES: Record<Bucket, PlaceCategory[]> = {
  morning: ["cafe"],
  evening: ["restaurant"],
  late: ["bar", "wine_bar", "cocktail_bar", "rooftop"],
  night: ["club"],
};

/** Everything we treat as going out at night. */
export const NIGHTLIFE: PlaceCategory[] = ["bar", "wine_bar", "cocktail_bar", "rooftop", "club"];

export const isNightlife = (category: PlaceCategory): boolean => NIGHTLIFE.includes(category);

export type Company = {
  /** Anyone under 18 on the trip. */
  withChildren: boolean;
  /** Interests the traveller stated, lowercase or not. */
  interests?: string[];
};

const has = (interests: string[], needle: string) =>
  interests.some((i) => i.toLowerCase().includes(needle));

/**
 * Which categories this traveller should see at all. Travelling with children
 * takes nightlife out entirely — not down-ranked, removed. Clubs need an
 * actual interest in nightlife.
 */
export function allowedCategories(company: Company): PlaceCategory[] {
  const interests = company.interests ?? [];
  const all = [...BUCKET_CATEGORIES.morning, ...BUCKET_CATEGORIES.evening, ...NIGHTLIFE];
  return all.filter((category) => {
    if (company.withChildren && isNightlife(category)) return false;
    if (category === "club" && !has(interests, "nightlife")) return false;
    return true;
  });
}

export function categoriesForBucket(bucket: Bucket, company: Company): PlaceCategory[] {
  const allowed = allowedCategories(company);
  return BUCKET_CATEGORIES[bucket].filter((category) => allowed.includes(category));
}

/** Buckets worth rendering for a given day, in order. */
export function bucketsForDay(company: Company): Bucket[] {
  return BUCKETS.filter((bucket) => categoriesForBucket(bucket, company).length > 0);
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);

/**
 * "Tonight in Lisbon", "Tomorrow morning", "Friday evening" — relative when
 * the day is close, named when it is not.
 */
export function bucketLabel(bucket: Bucket, date: string, city: string, today: string): string {
  const days = Math.round((dayOf(date).getTime() - dayOf(today).getTime()) / 86_400_000);
  const when =
    days === 0 ? "today" : days === 1 ? "tomorrow" : (WEEKDAY[dayOf(date).getUTCDay()] ?? "");

  if (bucket === "morning") {
    if (days === 0) return `This morning in ${city}`;
    if (days === 1) return `Tomorrow morning in ${city}`;
    return `${when} morning in ${city}`;
  }
  if (bucket === "evening") {
    if (days === 0) return `Tonight in ${city}`;
    if (days === 1) return `Tomorrow evening in ${city}`;
    return `${when} evening in ${city}`;
  }
  if (bucket === "late") {
    if (days === 0) return `A drink tonight in ${city}`;
    return `A drink ${days === 1 ? "tomorrow" : when} in ${city}`;
  }
  return days === 0 ? `Later tonight in ${city}` : `Late ${when} in ${city}`;
}
