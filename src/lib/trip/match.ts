/**
 * Name matching for "book this exact hotel / this exact car" requests.
 * Accent- and punctuation-insensitive, allows partial and substring hits.
 */

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words that carry no identity of their own. */
const STOP = new Set(["hotel", "hotels", "the", "a", "an", "de", "la", "le", "du", "del", "of", "and"]);

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** True when `candidate` plausibly is the requested venue. */
export function nameMatches(candidate: string, requested: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(requested);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wanted = tokens(requested);
  if (!wanted.length) return false;
  const have = new Set(tokens(candidate));
  const hits = wanted.filter((t) => have.has(t) || a.includes(t)).length;
  return hits / wanted.length >= 0.6;
}

/** Best match out of a list, or null when nothing is close enough. */
export function findByName<T>(
  items: T[],
  requested: string,
  nameOf: (item: T) => string,
): T | null {
  const exact = items.find((i) => normalizeName(nameOf(i)) === normalizeName(requested));
  if (exact) return exact;
  return items.find((i) => nameMatches(nameOf(i), requested)) ?? null;
}

/* ------------------- preference match scores ------------------- */

import type { SearchPrefs } from "./rank";
import type { TripSearchResponse } from "./types";

export type LineMatch = {
  /** 0–100; null when we have nothing to compare against. */
  score: number | null;
  /** Short reasons, e.g. "Preferred airline", "Above your minimum rating". */
  reasons: string[];
  misses: string[];
};

export type MatchSummary = {
  flight: LineMatch;
  stay: LineMatch;
  car: LineMatch;
};

export type BudgetStatus = {
  band: string | null;
  label: string;
  /** "within" | "near" | "over" | "unknown" */
  state: "within" | "near" | "over" | "unknown";
  ceilingEur: number | null;
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const contains = (text: string, needles: string[]) =>
  needles.some((n) => fold(text).includes(fold(n)));

function tally(checks: Array<{ ok: boolean; hit: string; miss: string }>): LineMatch {
  if (!checks.length) return { score: null, reasons: [], misses: [] };
  const passed = checks.filter((c) => c.ok);
  return {
    score: Math.round((passed.length / checks.length) * 100),
    reasons: passed.map((c) => c.hit),
    misses: checks.filter((c) => !c.ok).map((c) => c.miss),
  };
}

export function matchSummary(search: TripSearchResponse, prefs?: SearchPrefs | null): MatchSummary {
  const empty: LineMatch = { score: null, reasons: [], misses: [] };
  if (!prefs) return { flight: empty, stay: empty, car: empty };

  const flightChecks: Array<{ ok: boolean; hit: string; miss: string }> = [];
  const flight = search.flight;
  if (flight) {
    const carrier = `${flight.carrier} ${flight.flightNumbers.join(" ")}`;
    if (prefs.airlines.length && !prefs.airlines.includes("any")) {
      flightChecks.push({
        ok: contains(carrier, prefs.airlines),
        hit: "Airline you prefer",
        miss: "Not one of your preferred airlines",
      });
    }
  }

  const stayChecks: Array<{ ok: boolean; hit: string; miss: string }> = [];
  const stay = search.stay;
  if (stay) {
    if (prefs.hotelChains.length && !prefs.hotelChains.includes("any")) {
      stayChecks.push({
        ok: contains(stay.name, prefs.hotelChains),
        hit: "Hotel group you prefer",
        miss: "Not one of your preferred hotel groups",
      });
    }
    if (prefs.hotelStars.length && stay.rating != null) {
      stayChecks.push({
        ok: prefs.hotelStars.includes(String(Math.round(stay.rating))),
        hit: "Star level you asked for",
        miss: "Different star level than you asked for",
      });
    }
    if (stay.rating != null) {
      stayChecks.push({
        ok: stay.rating >= prefs.hotelMinRating,
        hit: "Above your minimum rating",
        miss: "Below your minimum rating",
      });
    }
  }

  const carChecks: Array<{ ok: boolean; hit: string; miss: string }> = [];
  const car = search.car;
  if (car) {
    if (prefs.carTransmission && prefs.carTransmission !== "any") {
      carChecks.push({
        ok: contains(car.transmission ?? "", [prefs.carTransmission]),
        hit: `${prefs.carTransmission === "automatic" ? "Automatic" : "Manual"} gearbox`,
        miss: "Different gearbox than you prefer",
      });
    }
    if (prefs.carBrands.length && !prefs.carBrands.includes("any")) {
      carChecks.push({
        ok: contains(car.vehicle ?? "", prefs.carBrands),
        hit: "Make you like",
        miss: "Not one of your preferred makes",
      });
    }
    if (prefs.carCompanies.length && !prefs.carCompanies.includes("any")) {
      carChecks.push({
        ok: contains(car.supplier ?? "", prefs.carCompanies),
        hit: "Rental company you prefer",
        miss: "Not one of your preferred rental companies",
      });
    }
  }

  return {
    flight: tally(flightChecks),
    stay: tally(stayChecks),
    car: tally(carChecks),
  };
}

const BANDS: Record<string, { label: string; ceiling: number | null }> = {
  u500: { label: "under €500", ceiling: 500 },
  "500_1500": { label: "€500–1,500", ceiling: 1500 },
  "1500_3000": { label: "€1,500–3,000", ceiling: 3000 },
  "3000plus": { label: "€3,000+", ceiling: null },
  nolimit: { label: "no limit", ceiling: null },
};

/** Compares the card total with the budget band from the traveller's profile. */
export function budgetStatus(totalEur: number, band: string | null): BudgetStatus {
  const info = band ? BANDS[band] : undefined;
  if (!info || info.ceiling == null) {
    return { band: band ?? null, label: info?.label ?? "", state: "unknown", ceilingEur: null };
  }
  const ratio = totalEur / info.ceiling;
  return {
    band,
    label: info.label,
    ceilingEur: info.ceiling,
    state: ratio > 1 ? "over" : ratio > 0.85 ? "near" : "within",
  };
}
