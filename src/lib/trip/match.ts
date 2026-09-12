/**
 * How well each line matches the traveller's saved preferences, in plain words.
 * Only preferences they actually filled in count, so an empty profile never
 * produces a low score — it produces no score at all.
 */
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
    const carrier = `${flight.carrier ?? ""} ${flight.summary ?? ""}`;
    if (prefs.airlines.length && !prefs.airlines.includes("any")) {
      flightChecks.push({
        ok: contains(carrier, prefs.airlines),
        hit: "Airline you prefer",
        miss: "Not one of your preferred airlines",
      });
    }
    if (typeof flight.stops === "number") {
      flightChecks.push({
        ok: flight.stops === 0,
        hit: "Direct flight",
        miss: "Has a connection",
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
