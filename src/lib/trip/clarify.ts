/**
 * The ONE question we may ask before searching.
 *
 * A sentence is only worth a question when guessing would send the traveller
 * to the wrong airport or the wrong week. Everything else is answered by the
 * most likely reading plus an honest assumption printed on the card.
 *
 * Hard rule: at most one question per sentence. Once a question has been asked
 * (including the mandatory children's ages one), we never ask a second — we
 * search with the best reading and say what we assumed.
 *
 * Pure and browser-safe: the chat, the card and the tests read the same rules.
 */

export type ClarifyKind =
  | "needs_destination"
  | "child_ages"
  | "no_dates"
  | "vague_week"
  | "which_airport"
  | "hotel_unmatched";

export type Clarification = {
  kind: ClarifyKind;
  /** One short question, in the traveller's chat. */
  question: string;
  /** Tappable answers; the free-text field stays available. */
  options: string[];
  placeholder: string;
};

/** Cities where the airport genuinely changes the trip. First entry is our default. */
export const MULTI_AIRPORT: Record<string, { iata: string; label: string }[]> = {
  London: [
    { iata: "LHR", label: "Heathrow" },
    { iata: "LGW", label: "Gatwick" },
    { iata: "STN", label: "Stansted" },
  ],
  Paris: [
    { iata: "CDG", label: "Charles de Gaulle" },
    { iata: "ORY", label: "Orly" },
  ],
  Milan: [
    { iata: "LIN", label: "Linate" },
    { iata: "MXP", label: "Malpensa" },
  ],
  Rome: [
    { iata: "FCO", label: "Fiumicino" },
    { iata: "CIA", label: "Ciampino" },
  ],
  "New York": [
    { iata: "JFK", label: "JFK" },
    { iata: "EWR", label: "Newark" },
    { iata: "LGA", label: "LaGuardia" },
  ],
  Berlin: [{ iata: "BER", label: "Brandenburg" }],
  Istanbul: [
    { iata: "IST", label: "Istanbul Airport" },
    { iata: "SAW", label: "Sabiha Gökçen" },
  ],
};

const DAY_TERMS =
  /\b(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday|today|tomorrow|tonight)\b|poniedzia|wtorek|środ|sroda|czwart|piąt|piat|sobot|niedziel|dzisiaj|jutro/i;

const DATE_TERMS =
  /\b\d{1,2}[./-]\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{1,2}\b|stycz|lut(?:y|ego)|marc|kwiet|maj(?:a|u)?\b|czerw|lip(?:ca|iec)|sierp|wrześ|wrzes|paździer|pazdzier|listopad|grud/i;

const PERIOD_TERMS = /\bweekend\b|week-end|wochenende|\b\d+\s*(?:nights?|days?)\b|\bnoc\w*|\bdni\b|\bdzień\b/i;

const NEXT_WEEK = /\bnext week\b|w przysz[lł]ym tygodniu|przysz[lł]y tydzie/i;

/** True when the sentence carries no usable travel timing at all. */
export function hasNoDates(sentence: string): boolean {
  return !DAY_TERMS.test(sentence) && !DATE_TERMS.test(sentence) && !PERIOD_TERMS.test(sentence);
}

/** "next week" with no day in it — could be five different trips. */
export function isVagueWeek(sentence: string): boolean {
  return NEXT_WEEK.test(sentence) && !DAY_TERMS.test(sentence) && !DATE_TERMS.test(sentence);
}

/** An airport already named in the sentence answers the airport question. */
export function mentionsAirport(sentence: string, city: string): boolean {
  const options = MULTI_AIRPORT[city] ?? [];
  const text = sentence.toLowerCase();
  return options.some(
    (o) => text.includes(o.iata.toLowerCase()) || text.includes(o.label.toLowerCase()),
  );
}

export type ClarifyContext = {
  /** Destination city as the parser read it. */
  destinationCity: string;
  /** A question has already been asked for this sentence. */
  alreadyAsked?: boolean;
  /** Airport codes the traveller has chosen before, from their preferences. */
  knownAirports?: string[];
  /** A named hotel from an earlier search that the supplier could not find. */
  unresolvedHotel?: string | null;
};

/**
 * The single question to ask, or null to search straight away.
 * Priority: the destination first — without a place, dates mean nothing —
 * then dates, then the airport, then a hotel wish we could not place.
 */
export function clarify(sentence: string, context: ClarifyContext): Clarification | null {
  // The destination outranks everything, including "already asked": we never
  // search, and never ask a later question, while we do not know the city.
  if (!context.destinationCity.trim()) {
    return {
      kind: "needs_destination",
      question: "Where are you going?",
      options: [],
      placeholder: "e.g. Milan",
    };
  }

  if (context.alreadyAsked) return null;

  if (context.unresolvedHotel) {
    return {
      kind: "hotel_unmatched",
      question: `We couldn't find ${context.unresolvedHotel}. Shall we look for something similar nearby, or do you have another hotel in mind?`,
      options: ["Something similar nearby", "Any good hotel"],
      placeholder: "Hotel name",
    };
  }

  if (hasNoDates(sentence)) {
    return {
      kind: "no_dates",
      question: "When would you like to travel?",
      options: ["This weekend", "Next weekend", "Tomorrow"],
      placeholder: "e.g. Thursday to Sunday",
    };
  }

  if (isVagueWeek(sentence)) {
    return {
      kind: "vague_week",
      question: "Which days next week?",
      options: ["Monday to Wednesday", "Wednesday to Friday", "Friday to Sunday"],
      placeholder: "e.g. Tuesday to Thursday",
    };
  }

  const airports = MULTI_AIRPORT[context.destinationCity] ?? [];
  const knows = (context.knownAirports ?? []).some((code) =>
    airports.some((o) => o.iata === code.toUpperCase()),
  );
  if (airports.length > 1 && !knows && !mentionsAirport(sentence, context.destinationCity)) {
    return {
      kind: "which_airport",
      question: `${context.destinationCity} has more than one airport. Which suits you?`,
      options: airports.map((o) => `${o.label} (${o.iata})`),
      placeholder: "No preference",
    };
  }

  return null;
}

/** The answer is folded back into the sentence, so the parser stays the one reader. */
export function applyAnswer(sentence: string, kind: ClarifyKind, answer: string): string {
  const clean = answer.trim();
  if (!clean) return sentence;
  if (kind === "needs_destination") return `${sentence} to ${clean}`.trim();
  if (kind === "child_ages") return `${sentence} (children aged ${clean})`;
  if (kind === "which_airport") return `${sentence} from ${clean}`;
  if (kind === "hotel_unmatched") return `${sentence} — ${clean}`;
  return `${sentence} ${clean}`;
}

/**
 * What we assumed when we searched anyway. Shown on the card so nothing is
 * hidden: "assumed Paris CDG".
 */
export function assumptionNote(sentence: string, city: string, iata: string): string | null {
  const airports = MULTI_AIRPORT[city] ?? [];
  if (airports.length <= 1) return null;
  if (mentionsAirport(sentence, city)) return null;
  return `assumed ${city} ${iata}`;
}
