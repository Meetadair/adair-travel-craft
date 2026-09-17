/**
 * Traveller memory: what Adair works out by itself and remembers.
 *
 * Two kinds of memory live here.
 *  - Place memory: what they actually chose in a given city. "The Grace, in
 *    St. Moritz, three stays." Written on every confirmed booking and every
 *    swap-to, never from a form.
 *  - Patterns: habits visible across bookings — the same airline again and
 *    again, always a morning departure, always booking months ahead. A pattern
 *    is only ever *suggested*; Adair asks once and the answer is final.
 *
 * Precedence is strict and never bent (see `resolvePreferences`):
 *   dealbreakers > stated preferences > confirmed patterns > place memory >
 *   learned ranking weights > supplier price.
 */
import type { Learned, StatedPrefs } from "./learning";

export type PlaceItemKind = "hotel" | "restaurant" | "car_supplier" | "airline" | "neighbourhood";

export type PlaceMemory = {
  place: string;
  itemKind: PlaceItemKind;
  itemRef: string | null;
  itemName: string;
  timesChosen: number;
  lastChosenAt: string;
  source: "booked" | "stated" | "swapped_to";
};

export type PatternKind =
  | "airline"
  | "hotel_chain"
  | "car_brand"
  | "morning_departure"
  | "no_connections"
  | "lead_time_early"
  | "lead_time_late"
  | "trip_length"
  | "spend_per_trip";

export type PatternStatus = "suggested" | "confirmed" | "rejected";

export type Pattern = {
  patternKind: PatternKind;
  value: string;
  confidence: number;
  evidenceCount: number;
  status: PatternStatus;
  askedAt?: string | null;
};

/** One booking, reduced to the facts a pattern can be read from. */
export type BookingFact = {
  airline: string | null;
  hotelChain: string | null;
  carBrand: string | null;
  /** Local departure hour, 0–23. */
  departHour: number | null;
  connections: number | null;
  /** Days between booking and departure. */
  leadDays: number | null;
  nights: number | null;
  spendEur: number | null;
};

/** Three of the same thing is a habit; two is a coincidence. */
export const EVIDENCE_THRESHOLD = 3;
/** Below this we keep watching and say nothing. */
export const ASK_CONFIDENCE = 0.6;

const confidenceOf = (hits: number, total: number) =>
  total === 0 ? 0 : Math.round((hits / total) * 100) / 100;

/** The place key we store memory under: the city name, else the airport code. */
export function placeKey(city: string | null | undefined, iata?: string | null): string {
  const clean = (city ?? "").trim();
  if (clean) return clean.toLowerCase();
  return (iata ?? "").trim().toUpperCase();
}

function commonest(
  values: (string | null)[],
): { value: string; hits: number; total: number } | null {
  const present = values.filter((v): v is string => Boolean(v && v.trim()));
  if (!present.length) return null;
  const counts = new Map<string, number>();
  for (const value of present) counts.set(value, (counts.get(value) ?? 0) + 1);
  const [value, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { value, hits, total: present.length };
}

/**
 * Habits read from real bookings. Everything comes back as "suggested": Adair
 * asks before it acts on any of it.
 */
export function detectPatterns(facts: BookingFact[]): Pattern[] {
  const found: Pattern[] = [];
  const add = (patternKind: PatternKind, value: string, hits: number, total: number) => {
    if (hits < EVIDENCE_THRESHOLD) return;
    found.push({
      patternKind,
      value,
      confidence: confidenceOf(hits, total),
      evidenceCount: hits,
      status: "suggested",
    });
  };

  const airline = commonest(facts.map((f) => f.airline));
  if (airline) add("airline", airline.value, airline.hits, airline.total);
  const chain = commonest(facts.map((f) => f.hotelChain));
  if (chain) add("hotel_chain", chain.value, chain.hits, chain.total);
  const car = commonest(facts.map((f) => f.carBrand));
  if (car) add("car_brand", car.value, car.hits, car.total);

  const hours = facts.map((f) => f.departHour).filter((h): h is number => h != null);
  const mornings = hours.filter((h) => h < 10).length;
  if (hours.length) add("morning_departure", "before 10:00", mornings, hours.length);

  const legs = facts.map((f) => f.connections).filter((c): c is number => c != null);
  const direct = legs.filter((c) => c === 0).length;
  if (legs.length) add("no_connections", "direct only", direct, legs.length);

  const leads = facts.map((f) => f.leadDays).filter((d): d is number => d != null);
  if (leads.length) {
    const early = leads.filter((d) => d >= 60).length;
    const late = leads.filter((d) => d <= 7).length;
    add("lead_time_early", "60+ days ahead", early, leads.length);
    add("lead_time_late", "within a week", late, leads.length);
  }

  const nights = facts.map((f) => f.nights).filter((n): n is number => n != null);
  if (nights.length >= EVIDENCE_THRESHOLD) {
    const typical = Math.round(nights.reduce((a, b) => a + b, 0) / nights.length);
    add("trip_length", `${typical} nights`, nights.length, nights.length);
  }

  const spends = facts.map((f) => f.spendEur).filter((s): s is number => s != null && s > 0);
  if (spends.length >= EVIDENCE_THRESHOLD) {
    const typical = Math.round(spends.reduce((a, b) => a + b, 0) / spends.length);
    add("spend_per_trip", `about €${typical}`, spends.length, spends.length);
  }

  return found;
}

/**
 * Merges freshly detected patterns with what we already hold. A rejected
 * pattern stays rejected and is never asked about again; a confirmed one keeps
 * its standing and only gains evidence.
 */
export function mergePatterns(existing: Pattern[], detected: Pattern[]): Pattern[] {
  const keyOf = (p: Pattern) => `${p.patternKind}:${p.value.toLowerCase()}`;
  const byKey = new Map(existing.map((p) => [keyOf(p), p]));
  for (const fresh of detected) {
    const key = keyOf(fresh);
    const known = byKey.get(key);
    if (!known) {
      byKey.set(key, fresh);
      continue;
    }
    if (known.status === "rejected") continue;
    byKey.set(key, {
      ...known,
      confidence: fresh.confidence,
      evidenceCount: Math.max(known.evidenceCount, fresh.evidenceCount),
    });
  }
  return [...byKey.values()];
}

/**
 * The one pattern worth asking about right now, or null. Asked once: anything
 * already answered or already put to them stays quiet.
 */
export function patternToAsk(patterns: Pattern[]): Pattern | null {
  const open = patterns
    .filter(
      (p) =>
        p.status === "suggested" &&
        !p.askedAt &&
        p.evidenceCount >= EVIDENCE_THRESHOLD &&
        p.confidence >= ASK_CONFIDENCE,
    )
    .sort((a, b) => b.confidence - a.confidence);
  return open[0] ?? null;
}

/** Preferences after every layer has had its say, in the right order. */
export type ResolvedPrefs = {
  airlines: string[];
  hotelChains: string[];
  carBrands: string[];
  /** Hotel names to propose first in this city, best remembered first. */
  rememberedHotels: string[];
  rememberedCarSuppliers: string[];
  /** Why each addition is there — used for the Settings list and the tests. */
  reasons: { value: string; from: "stated" | "pattern" | "place" }[];
};

const dealbrokenBy = (dealbreakers: string[], value: string) =>
  dealbreakers.some((rule) => rule.toLowerCase().includes(value.toLowerCase()));

/**
 * The precedence chain. Nothing learned or remembered may override what the
 * traveller said, and nothing may contradict a dealbreaker.
 */
export function resolvePreferences(
  stated: StatedPrefs,
  patterns: Pattern[],
  place: PlaceMemory[],
  currentPlace: string,
  learned?: Learned,
): ResolvedPrefs {
  const reasons: ResolvedPrefs["reasons"] = [];
  const airlines = [...stated.airlines];
  const hotelChains = [...stated.hotelChains];
  const carBrands = [...stated.carBrands];
  for (const value of [...stated.airlines, ...stated.hotelChains, ...stated.carBrands])
    reasons.push({ value, from: "stated" });

  const push = (list: string[], value: string, from: "pattern" | "place") => {
    const clean = value.trim();
    if (!clean) return;
    if (dealbrokenBy(stated.dealbreakers, clean)) return;
    // Learned dislikes never win over a confirmed pattern, but they do not
    // add anything either; a stated value is already in the list.
    if (list.some((existing) => existing.toLowerCase() === clean.toLowerCase())) return;
    list.push(clean);
    reasons.push({ value: clean, from });
  };

  for (const pattern of patterns.filter((p) => p.status === "confirmed")) {
    if (pattern.patternKind === "airline") push(airlines, pattern.value, "pattern");
    if (pattern.patternKind === "hotel_chain") push(hotelChains, pattern.value, "pattern");
    if (pattern.patternKind === "car_brand") push(carBrands, pattern.value, "pattern");
  }

  const here = place
    .filter((row) => row.place === currentPlace)
    .sort((a, b) => b.timesChosen - a.timesChosen || b.lastChosenAt.localeCompare(a.lastChosenAt));
  const rememberedHotels: string[] = [];
  const rememberedCarSuppliers: string[] = [];
  for (const row of here) {
    if (dealbrokenBy(stated.dealbreakers, row.itemName)) continue;
    if (row.itemKind === "hotel" && !rememberedHotels.includes(row.itemName)) {
      rememberedHotels.push(row.itemName);
      reasons.push({ value: row.itemName, from: "place" });
    }
    if (row.itemKind === "car_supplier" && !rememberedCarSuppliers.includes(row.itemName))
      rememberedCarSuppliers.push(row.itemName);
    if (row.itemKind === "airline") push(airlines, row.itemName, "place");
  }

  // A learned dislike is the weakest signal: it may not remove anything above.
  if (learned?.avoid.length) {
    for (const entry of learned.avoid) {
      const stronger = reasons.some(
        (r) => r.value.toLowerCase() === entry.brandId.toLowerCase() && r.from !== "place",
      );
      if (stronger) continue;
    }
  }

  return { airlines, hotelChains, carBrands, rememberedHotels, rememberedCarSuppliers, reasons };
}

/** "You stayed at the Grace last time in St. Moritz — same again?" */
export function sameAgainQuestion(
  memory: PlaceMemory[],
  currentPlace: string,
  cityLabel: string,
  copy: { sameAgain: string; full: string },
): { hotel: string; question: string } | null {
  const hotel = memory
    .filter((row) => row.place === currentPlace && row.itemKind === "hotel")
    .sort((a, b) => b.timesChosen - a.timesChosen)[0];
  if (!hotel) return null;
  return {
    hotel: hotel.itemName,
    question: copy.sameAgain.replace("{hotel}", hotel.itemName).replace("{city}", cityLabel),
  };
}

/** "The Grace is full on those dates — the closest in character is …" */
export function notAvailableSentence(
  hotel: string,
  nearest: string | null,
  copy: { full: string; nothingClose: string },
): string {
  return nearest
    ? copy.full.replace("{hotel}", hotel).replace("{nearest}", nearest)
    : copy.nothingClose.replace("{hotel}", hotel);
}

/** "Lufthansa, window, the Grace — as usual." One line, never a list. */
export function asUsualLine(
  parts: (string | null | undefined)[],
  copy: { asUsual: string },
): string | null {
  const kept = parts.filter((p): p is string => Boolean(p && p.trim())).slice(0, 3);
  if (!kept.length) return null;
  return copy.asUsual.replace("{items}", kept.join(", "));
}

/** Why this trip departs from memory, said plainly. */
export function deviationSentence(
  expected: string,
  actual: string,
  reason: string,
  copy: { deviation: string },
): string {
  return copy.deviation
    .replace("{expected}", expected)
    .replace("{actual}", actual)
    .replace("{reason}", reason);
}

/** Plain sentences for "What Adair knows about you". */
export function knowsSentences(
  patterns: Pattern[],
  place: PlaceMemory[],
  learnedLines: string[],
): { id: string; text: string; group: "pattern" | "place" | "ranking" }[] {
  const lines: { id: string; text: string; group: "pattern" | "place" | "ranking" }[] = [];
  for (const pattern of patterns.filter((p) => p.status === "confirmed"))
    lines.push({
      id: `pattern:${pattern.patternKind}:${pattern.value}`,
      text: `${describePattern(pattern)} — from ${pattern.evidenceCount} trips`,
      group: "pattern",
    });
  for (const row of place)
    lines.push({
      id: `place:${row.place}:${row.itemKind}:${row.itemName}`,
      text: `${row.place} — ${row.itemName}, ${row.timesChosen} ${row.timesChosen === 1 ? "time" : "times"}`,
      group: "place",
    });
  for (const [index, text] of learnedLines.entries())
    lines.push({ id: `ranking:${index}`, text, group: "ranking" });
  return lines;
}

export function describePattern(pattern: Pattern): string {
  switch (pattern.patternKind) {
    case "airline":
      return `you usually fly ${pattern.value}`;
    case "hotel_chain":
      return `you usually stay with ${pattern.value}`;
    case "car_brand":
      return `you usually drive a ${pattern.value}`;
    case "morning_departure":
      return "you usually leave in the morning";
    case "no_connections":
      return "you usually fly direct";
    case "lead_time_early":
      return "you usually book well ahead";
    case "lead_time_late":
      return "you usually book close to the date";
    case "trip_length":
      return `your trips are usually ${pattern.value}`;
    case "spend_per_trip":
      return `your trips usually cost ${pattern.value}`;
  }
}
