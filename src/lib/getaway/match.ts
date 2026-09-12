/**
 * Adair Getaway matching. The order is fixed and deliberate:
 *   1. REACH   — can they actually get there (real distance from their home airport)
 *   2. SEASON  — is the destination in season for that theme (enforced in the query)
 *   3. INTEREST— does it fit the profile, with the dealbreakers as hard filters
 *   4. PRICE   — only then, and only as a tie-breaker against our own baseline
 * Nothing here invents data: an unknown origin or a missing price is reported as
 * unknown rather than guessed.
 */

export type GeoPoint = { lat: number; lon: number };

const R = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Gate-to-gate estimate: taxi + climb + cruise at ~750 km/h. */
export function flightHours(km: number): number {
  return Math.round((0.7 + km / 750) * 10) / 10;
}

/** Motorway estimate at ~85 km/h door to door, with one short stop. */
export function driveHours(km: number): number {
  return Math.round((0.2 + km / 85) * 10) / 10;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export type Reach = {
  /** Reachable at all — false means never propose it. */
  ok: boolean;
  /** Short enough for a weekend (3 h flight or 3 h drive). */
  weekend: boolean;
  mode: "fly" | "drive";
  hours: number;
  km: number;
  label: string;
};

export const WEEKEND_MAX_HOURS = 3;

/**
 * Reach from a home airport. `drivableFrom` lists the airport codes a
 * destination is genuinely drivable from — driving is only considered for those.
 */
export function reachFrom(
  origin: GeoPoint | null,
  originIata: string,
  destination: GeoPoint,
  drivableFrom: string[],
): Reach | null {
  if (!origin) return null;
  const km = distanceKm(origin, destination);
  const drivable = drivableFrom.includes(originIata.toUpperCase());
  const fly = flightHours(km);
  const drive = drivable ? driveHours(km) : null;

  if (drive !== null && drive <= WEEKEND_MAX_HOURS) {
    return {
      ok: true,
      weekend: true,
      mode: "drive",
      hours: drive,
      km,
      label: `${formatHours(drive)} drive from ${originIata}`,
    };
  }
  return {
    ok: true,
    weekend: fly <= WEEKEND_MAX_HOURS,
    mode: "fly",
    hours: fly,
    km,
    label: `${formatHours(fly)} flight from ${originIata}`,
  };
}

/**
 * SEASON as a hard rule: a destination is only ever proposed inside the season
 * window on its theme join row. Enforced in the query and re-checked here.
 */
export function inSeason(seasonMonths: number[] | null | undefined, month: number): boolean {
  return Array.isArray(seasonMonths) && seasonMonths.includes(month);
}

/** Profile interests → the tags used on themes. */
const INTEREST_TAGS: Record<string, string[]> = {
  ski: ["skiing", "snowboarding", "mountains"],
  nature: ["hiking", "mountains", "nature", "outdoors"],
  beach: ["beach", "sun", "swimming"],
  wine: ["wine", "food", "gastronomy"],
  wellness: ["spa", "wellness", "relax"],
  museums: ["art", "history", "museums"],
  architecture: ["architecture", "history", "art"],
  family: ["family", "children"],
  sports: ["cycling", "sport", "outdoors"],
  golf: ["sport", "outdoors"],
  music: ["art"],
  nightlife: ["art"],
  shopping: ["art"],
};

export type GetawayProfile = {
  interests: string[];
  cuisines: string[];
  budgetBand: string | null;
  /** Part 2 answers: travel style, companions, trip length. */
  extraAnswers: Record<string, string[]>;
};

export type ThemeInput = {
  id: string;
  slug: string;
  name: string;
  interestTags: string[];
};

export type ScoredCandidate = {
  destinationId: string;
  themeId: string;
  score: number;
  reasons: string[];
};

/**
 * How well a themed destination fits the profile. Returns the score and the
 * plain-language reasons we can show the traveller.
 */
export function interestScore(
  theme: ThemeInput,
  profile: GetawayProfile,
  destinationName: string,
  familyFriendlyPlaces: boolean,
): { score: number; reasons: string[] } {
  const tags = new Set(theme.interestTags.map((t) => t.toLowerCase()));
  const reasons: string[] = [];
  let score = 0;

  const matchedInterests = profile.interests.filter((interest) =>
    (INTEREST_TAGS[interest] ?? [interest]).some((tag) => tags.has(tag)),
  );
  score += matchedInterests.length * 20;
  if (matchedInterests.length) reasons.push(`it matches ${theme.name.toLowerCase()} on your profile`);

  if (theme.slug === "wine" && profile.cuisines.length) {
    score += 8;
    reasons.push("you care about food and wine");
  }

  const companions = profile.extraAnswers["companions"] ?? [];
  if (companions.includes("children") || companions.includes("family")) {
    if (theme.slug === "family" || familyFriendlyPlaces) {
      score += 12;
      reasons.push("it works with children along");
    }
  }

  const style = profile.extraAnswers["travelStyle"] ?? [];
  if (style.includes("slow") && theme.slug === "spa-wellness") score += 6;
  if (style.includes("active") && (theme.slug === "cycling" || theme.slug === "mountains-lakes")) {
    score += 6;
  }

  if (profile.budgetBand) score += 2;

  reasons.push(`${destinationName} is in season now`);
  return { score, reasons };
}

/**
 * Price as the LAST step: cheaper than our own 90-day baseline nudges a
 * candidate up, but never above a better-matched one.
 */
export function applyPriceTieBreak(
  candidates: ScoredCandidate[],
  dealBonus: Record<string, number>,
): ScoredCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (dealBonus[b.destinationId] ?? 0) - (dealBonus[a.destinationId] ?? 0);
  });
}

/** Is this price a genuine deal against our own history for the same route? */
export function dealVerdict(
  currentMinor: number | null,
  historyMinor: number[],
): { label: string; better: boolean } | null {
  if (currentMinor === null || historyMinor.length < 4) return null;
  const sorted = [...historyMinor].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (currentMinor <= median * 0.85) {
    return { label: "Below the usual price on this route", better: true };
  }
  if (currentMinor >= median * 1.15) {
    return { label: "Above the usual price on this route", better: false };
  }
  return { label: "About the usual price on this route", better: false };
}

/** Monday of the current week, as an ISO date. */
export function weekStartIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/** The next `count` Friday→Sunday pairs, used by the nightly price check. */
export function comingWeekends(count = 4, now = new Date()): Array<{ depart: string; return: string }> {
  const out: Array<{ depart: string; return: string }> = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < count; i += 1) {
    const depart = new Date(d.getTime() + i * 7 * 86_400_000);
    const back = new Date(depart.getTime() + 2 * 86_400_000);
    out.push({ depart: depart.toISOString().slice(0, 10), return: back.toISOString().slice(0, 10) });
  }
  return out;
}
