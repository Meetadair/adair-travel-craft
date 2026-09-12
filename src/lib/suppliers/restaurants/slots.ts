/**
 * Which evenings of the trip could take a dinner reservation, and the
 * criteria the traveller's own profile sets for each of them.
 */
import type { TripSearchResponse } from "@/lib/trip/types";
import type { RestaurantCriteria } from "@/lib/suppliers/types";

export type FoodPrefs = {
  cuisines: string[];
  diets: string[];
  interests: string[];
  maxKm: number | null;
  budgetBand: string | null;
};

const DINNER_TIME = "19:30";

/** Every night of the stay, ordered, capped so the card stays readable. */
export function dinnerDates(search: TripSearchResponse, max = 5): string[] {
  const start = Date.parse(`${search.request.departDate}T12:00:00Z`);
  const end = Date.parse(`${search.request.returnDate}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const dates: string[] = [];
  for (let t = start; t <= end && dates.length < max; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export function dinnerCriteria(
  search: TripSearchResponse,
  prefs: FoodPrefs,
  date: string,
  time = DINNER_TIME,
  partySize?: number,
): RestaurantCriteria {
  return {
    city: search.request.destinationCity,
    lat: search.request.lat ?? null,
    lon: search.request.lon ?? null,
    date,
    time,
    partySize: Math.max(1, partySize ?? search.request.passengers),
    cuisines: prefs.cuisines,
    diets: prefs.diets,
    interests: prefs.interests,
    maxKm: prefs.maxKm,
    budgetBand: prefs.budgetBand,
  };
}

/** Plain-language list of what we would filter on, for the honest empty state. */
export function criteriaLabels(prefs: FoodPrefs, partySize: number): string[] {
  const labels: string[] = [`Table for ${partySize}`];
  if (prefs.cuisines.length) labels.push(prefs.cuisines.join(", "));
  if (prefs.diets.length) labels.push(prefs.diets.join(", "));
  if (prefs.maxKm) labels.push(`within ${prefs.maxKm} km of your hotel`);
  if (prefs.budgetBand) labels.push(prefs.budgetBand);
  return labels;
}
