/**
 * Example prompts built from the signed-in customer's own profile.
 *
 * Pure: the server function gathers the data, this file turns it into
 * sentences. Every departure is the customer's home city — we never suggest a
 * city they don't fly from.
 */

export type SuggestionInput = {
  /** Home airport city name, e.g. "Warsaw". Required — no examples without it. */
  homeCity: string | null;
  /** Most recent booked trip, if any. */
  pastTrip?: { city: string; startDate: string | null } | null;
  /** Default invoice company name, if any. */
  companyName?: string | null;
  /** Best getaway destination already filtered for reach and season. */
  getaway?: { city: string; interest: string | null } | null;
  /** A business city within reach, used for the must-arrive-by example. */
  businessCity?: string | null;
};

export type Suggestion = { id: string; text: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthName(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const month = Number(iso.slice(5, 7));
  return month >= 1 && month <= 12 ? (MONTHS[month - 1] as string) : null;
}

/**
 * Candidates in priority order. Anything the data doesn't support is skipped
 * rather than filled with generic text.
 */
export function buildSuggestions(input: SuggestionInput): Suggestion[] {
  const home = input.homeCity?.trim();
  if (!home) return [];

  const out: Suggestion[] = [];

  const past = input.pastTrip;
  if (past?.city) {
    const month = monthName(past.startDate);
    out.push({
      id: "repeat",
      text: month
        ? `Same as ${past.city} in ${month}, but a week later — from ${home}.`
        : `${home} to ${past.city} again, same shape as last time, but a week later.`,
    });
  }

  const company = input.companyName?.trim();
  if (company) {
    out.push({
      id: "company",
      text: `${home} to Vienna Tuesday to Thursday, invoice to ${company}.`,
    });
  }

  const getaway = input.getaway;
  if (getaway?.city) {
    out.push({
      id: "getaway",
      text: getaway.interest
        ? `A long weekend of ${getaway.interest} in ${getaway.city}, leaving ${home} Friday.`
        : `A long weekend in ${getaway.city}, leaving ${home} Friday.`,
    });
  }

  const businessCity = input.businessCity?.trim();
  if (businessCity) {
    out.push({
      id: "arrive-by",
      text: `I need to be in ${businessCity} by 3pm on Thursday, back the same evening — from ${home}.`,
    });
  }

  return out;
}

/**
 * Rotate the candidates so the same three aren't shown forever: a stable daily
 * seed per customer, so a reload during the day doesn't reshuffle under them.
 */
export function rotateSuggestions(
  candidates: Suggestion[],
  seed: string,
  count = 3,
): Suggestion[] {
  if (candidates.length <= count) return candidates;
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const offset = hash % candidates.length;
  return Array.from({ length: count }, (_, i) => candidates[(offset + i) % candidates.length]!);
}

/** Seed for `rotateSuggestions`: one rotation per customer per day. */
export const dailySeed = (userId: string, now = new Date()): string =>
  `${userId}:${now.toISOString().slice(0, 10)}`;
