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

/**
 * How well each line fits the preferences this traveller actually stated.
 * Only differentiating criteria count, and only ones they filled in: three
 * stated preferences give "3 of 3", never padded out.
 */
import type { SearchPrefs } from "./rank";
import type { CarResult, FlightResult, StayResult, TripSearchResponse } from "./types";

export type Criterion = { ok: boolean; label: string };

export type LineMatch = {
  met: number;
  total: number;
  criteria: Criterion[];
};

export type MatchSummary = {
  flight: LineMatch | null;
  stay: LineMatch | null;
  car: LineMatch | null;
};

export type BudgetStatus = {
  state: "within" | "over" | "unknown";
  /** e.g. "€500–1,500" */
  range: string;
  ceilingEur: number | null;
  overEur: number;
  /** The line pushing the trip over, when one clearly dominates. */
  culprit: "flight" | "stay" | "car" | null;
  culpritLabel: string | null;
  /** What a swap on that line would bring the trip down to. */
  fixTotalEur: number | null;
};

const flat = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const has = (text: string, needles: string[]) =>
  needles.some((n) => flat(text).includes(flat(n)));

const pretty = (value: string) =>
  value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const wanted = (list: string[]) => list.filter((v) => v && v !== "any" && v !== "nopref" && v !== "none");

/** Brand ids expand to the brand's name and aliases before matching supplier text. */
const brandTerms = (list: string[]) => wanted(list).flatMap((id) => brandWords(id));

function summarise(criteria: Criterion[]): LineMatch | null {
  if (!criteria.length) return null;
  return { met: criteria.filter((c) => c.ok).length, total: criteria.length, criteria };
}

function flightCriteria(flight: FlightResult, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  const airlines = brandTerms(prefs.airlines);
  if (airlines.length) {
    const text = `${flight.carrier} ${flight.flightNumbers.join(" ")}`;
    out.push({
      ok: has(text, airlines),
      label: has(text, airlines)
        ? `${flight.carrier} — one of your preferred airlines`
        : `${flight.carrier} is not one of your preferred airlines`,
    });
  }
  if (prefs.cabinClass && prefs.cabinClass !== "any") {
    const ok = flat(flight.cabin) === flat(prefs.cabinClass);
    out.push({
      ok,
      label: ok
        ? `${pretty(flight.cabin)} (your preference: ${pretty(prefs.cabinClass)})`
        : `${pretty(flight.cabin)} — you prefer ${pretty(prefs.cabinClass)}`,
    });
  }
  if (typeof flight.stops === "number" && typeof prefs.maxConnections === "number") {
    const ok = flight.stops <= prefs.maxConnections;
    out.push({
      ok,
      label: `${flight.stops === 0 ? "Direct" : `${flight.stops} connection${flight.stops > 1 ? "s" : ""}`} (your limit: ${prefs.maxConnections})`,
    });
  }
  return out;
}

function stayCriteria(stay: StayResult, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  const stars = wanted(prefs.hotelStars);
  if (stars.length && stay.rating != null) {
    const value = String(Math.round(stay.rating));
    const ok = stars.includes(value);
    out.push({
      ok,
      label: ok
        ? `${value} stars (you asked for ${stars.join(", ")})`
        : `${value} stars — you asked for ${stars.join(", ")}`,
    });
  }
  if (stay.rating != null && prefs.hotelMinRating) {
    const ok = stay.rating >= prefs.hotelMinRating;
    out.push({
      ok,
      label: `Rated ${stay.rating} (your minimum: ${prefs.hotelMinRating})`,
    });
  }
  const chains = brandTerms(prefs.hotelChains);
  if (chains.length) {
    const ok = has(stay.name, chains);
    out.push({
      ok,
      label: ok
        ? "One of your preferred hotel groups"
        : "Not one of your preferred hotel groups (none available on these dates)",
    });
  }
  const types = wanted(prefs.hotelTypes);
  if (types.length) {
    const ok = has(`${stay.name} ${stay.address}`, types);
    out.push({
      ok,
      label: ok ? `${pretty(types.find((t) => has(stay.name + stay.address, [t])) ?? types[0]!)} property` : `Not clearly a ${types.map(pretty).join(" / ")} property`,
    });
  }
  const amenities = wanted(prefs.hotelAmenities);
  for (const amenity of amenities.slice(0, 4)) {
    const ok = has(`${stay.name} ${stay.address}`, [amenity]);
    out.push({
      ok,
      label: ok ? pretty(amenity) : `${pretty(amenity)} not confirmed for this property`,
    });
  }
  return out;
}

function carCriteria(car: CarResult, prefs: SearchPrefs): Criterion[] {
  const out: Criterion[] = [];
  const brands = wanted(prefs.carBrands);
  if (brands.length) {
    const ok = has(car.vehicle, brands);
    out.push({
      ok,
      label: ok ? `${car.vehicle} — a make you like` : `${car.vehicle} is not one of your preferred makes`,
    });
  }
  if (prefs.carClass && prefs.carClass !== "any") {
    const ok = has(car.vehicle, [prefs.carClass]);
    out.push({
      ok,
      label: ok
        ? `${pretty(prefs.carClass)} class`
        : `Not clearly ${pretty(prefs.carClass)} class`,
    });
  }
  if (prefs.carTransmission && prefs.carTransmission !== "any") {
    const ok = has(car.transmission || "", [prefs.carTransmission]);
    out.push({
      ok,
      label: ok
        ? `${pretty(prefs.carTransmission)} gearbox`
        : `${pretty(car.transmission || "unknown")} gearbox — you prefer ${pretty(prefs.carTransmission)}`,
    });
  }
  const companies = brandTerms(prefs.carCompanies);
  if (companies.length) {
    const ok = has(car.supplier, companies);
    out.push({
      ok,
      label: ok
        ? `${car.supplier} — a rental company you prefer`
        : `${car.supplier} is not one of your preferred rental companies`,
    });
  }
  return out;
}

export function matchSummary(
  search: TripSearchResponse,
  prefs?: SearchPrefs | null,
): MatchSummary {
  if (!prefs) return { flight: null, stay: null, car: null };
  return {
    flight: search.flight ? summarise(flightCriteria(search.flight, prefs)) : null,
    stay: search.stay ? summarise(stayCriteria(search.stay, prefs)) : null,
    car: search.car ? summarise(carCriteria(search.car, prefs)) : null,
  };
}

/**
 * Score a real restaurant offer against the food preferences the traveller
 * stated. Only stated criteria count, exactly as for the other lines.
 */
export function restaurantCriteria(
  offer: { cuisine: string | null; distanceKm: number | null; partySize: number },
  prefs: { cuisines: string[]; diets: string[]; maxKm: number | null },
): Criterion[] {
  const out: Criterion[] = [];
  const cuisines = wanted(prefs.cuisines);
  if (cuisines.length) {
    const ok = has(offer.cuisine ?? "", cuisines);
    out.push({
      ok,
      label: ok
        ? `${pretty(offer.cuisine ?? "")} — a cuisine you like`
        : `${pretty(offer.cuisine ?? "unknown")} is not one of your preferred cuisines`,
    });
  }
  const diets = wanted(prefs.diets);
  for (const diet of diets) {
    out.push({ ok: true, label: `${pretty(diet)} options available` });
  }
  if (prefs.maxKm != null && offer.distanceKm != null) {
    const ok = offer.distanceKm <= prefs.maxKm;
    out.push({
      ok,
      label: `${offer.distanceKm.toFixed(1)} km from your hotel (your limit: ${prefs.maxKm} km)`,
    });
  }
  return out;
}

export function restaurantMatch(
  offer: { cuisine: string | null; distanceKm: number | null; partySize: number },
  prefs: { cuisines: string[]; diets: string[]; maxKm: number | null },
): LineMatch | null {
  const criteria = restaurantCriteria(offer, prefs);
  return criteria.length ? summarise(criteria) : null;
}

const BANDS: Record<string, { range: string; ceiling: number | null }> = {
  u500: { range: "under €500", ceiling: 500 },
  "500_1500": { range: "€500–1,500", ceiling: 1500 },
  "1500_3000": { range: "€1,500–3,000", ceiling: 3000 },
  "3000plus": { range: "€3,000+", ceiling: null },
  nolimit: { range: "no limit", ceiling: null },
};

/**
 * Where the trip total sits against their stated budget, and which line to
 * swap when it does not fit.
 */
export function budgetStatus(
  totalEur: number,
  band: string | null,
  lines?: { flight: number | null; stay: number | null; car: number | null },
  cheapestAlternative?: { flight: number | null; stay: number | null; car: number | null },
): BudgetStatus {
  const info = band ? BANDS[band] : undefined;
  if (!info || info.ceiling == null) {
    return {
      state: "unknown",
      range: info?.range ?? "",
      ceilingEur: null,
      overEur: 0,
      culprit: null,
      culpritLabel: null,
      fixTotalEur: null,
    };
  }
  const over = Math.round((totalEur - info.ceiling) * 100) / 100;
  if (over <= 0) {
    return {
      state: "within",
      range: info.range,
      ceilingEur: info.ceiling,
      overEur: 0,
      culprit: null,
      culpritLabel: null,
      fixTotalEur: null,
    };
  }

  // Which line dominates the total, and what a swap there would save.
  let culprit: BudgetStatus["culprit"] = null;
  let fixTotalEur: number | null = null;
  if (lines) {
    const entries = (["flight", "stay", "car"] as const)
      .map((kind) => ({ kind, amount: lines[kind] ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
    const top = entries[0];
    if (top && top.amount > 0) {
      culprit = top.kind;
      const cheaper = cheapestAlternative?.[top.kind];
      if (cheaper != null && cheaper < top.amount) {
        fixTotalEur = Math.round((totalEur - (top.amount - cheaper)) * 100) / 100;
      }
    }
  }

  return {
    state: "over",
    range: info.range,
    ceilingEur: info.ceiling,
    overEur: over,
    culprit,
    culpritLabel: culprit === "stay" ? "the hotel" : culprit === "flight" ? "the flight" : culprit === "car" ? "the car" : null,
    fixTotalEur,
  };
}
