/**
 * What did the customer actually say? Every input is classified before
 * anything else happens, so "hey" never turns into a trip to Milan.
 *
 * The rules here are the deterministic layer: they run in the browser, cost
 * nothing, and are also the fallback when the language model is unavailable.
 */
import { findCity } from "./cities";

export type IntentKind =
  "greeting" | "trip" | "amendment" | "product_question" | "booking_question" | "unclear";

export type Intent = {
  kind: IntentKind;
  /** True when the rules decided it, false when a model did. */
  fromRules: boolean;
};

const GREETINGS = [
  "hi",
  "hey",
  "hello",
  "yo",
  "hallo",
  "hola",
  "ciao",
  "bonjour",
  "salut",
  "czesc",
  "cześć",
  "witam",
  "hej",
  "dzien dobry",
  "dzień dobry",
  "good morning",
  "good evening",
  "good afternoon",
  "thanks",
  "thank you",
  "dzieki",
  "dzięki",
  "ok",
  "okay",
];

const AMENDMENT_TERMS =
  /\b(not this|another|different|instead|earlier|later|cheaper|change|swap|add a|add the|remove|drop|bez|zamiast|inny|inne|wcze[sś]niej|p[oó][zź]niej|ta[nń]sz|zmie[nń]|dodaj|usu[nń])\b/i;

const PRODUCT_TERMS =
  /\b(how does (this|it)|how do you|what (do|can) you|do you book|what does it cost|how much do you charge|your fee|commission|is this free|what is adair|who are you|jak to dzia[lł]a|co potrafisz|ile to kosztuje|czym jest adair|prowizj)\b/i;

const BOOKING_TERMS =
  /\b(my (flight|trip|hotel|booking|reservation)|when (is|do) (my|i)|cancel my|cancel (the )?[a-z]+ trip|my invoice|moj[ae]? (lot|podr[oó][zż]|rezerwacj)|kiedy (mam|jest)|anuluj)\b/i;

const QUESTION_MARK = /\?\s*$/;

/** A word that could carry a trip: a city we know, or an airport code. */
export function mentionsDestination(sentence: string): boolean {
  return findCity(` ${sentence.toLowerCase()} `) != null;
}

function isGreetingOnly(sentence: string): boolean {
  const clean = sentence
    .toLowerCase()
    .replace(/[!.,?]+/g, " ")
    .trim();
  if (!clean) return false;
  const words = clean.split(/\s+/);
  if (words.length > 3) return false;
  return GREETINGS.some((term) => clean === term || clean.startsWith(`${term} `));
}

/**
 * Rule-based intent. `hasCard` tells us whether a trip is already on screen,
 * which is what separates "earlier flight" (amendment) from a fresh request.
 */
export function ruleIntent(sentence: string, hasCard = false): IntentKind {
  const text = sentence.trim();
  if (!text) return "unclear";
  if (isGreetingOnly(text)) return "greeting";
  if (PRODUCT_TERMS.test(text)) return "product_question";
  if (BOOKING_TERMS.test(text)) return "booking_question";
  if (hasCard && AMENDMENT_TERMS.test(text) && !mentionsDestination(text)) return "amendment";
  if (mentionsDestination(text)) return "trip";
  if (QUESTION_MARK.test(text)) return "product_question";
  return "unclear";
}

/** Accepts only the categories we know; anything else is unclear. */
export function normaliseIntent(value: string): IntentKind {
  const clean = value.trim().toLowerCase();
  const known: IntentKind[] = [
    "greeting",
    "trip",
    "amendment",
    "product_question",
    "booking_question",
    "unclear",
  ];
  return known.find((kind) => clean === kind) ?? "unclear";
}

/**
 * What Adair says when there is nothing to search. The strings come from the
 * dictionary; this only picks which one.
 */
export function replyFor(
  kind: IntentKind,
  copy: {
    greeting: string;
    product: string;
    booking: string;
    unclear: string;
    needsDestination: string;
  },
): string | null {
  if (kind === "greeting") return copy.greeting;
  if (kind === "product_question") return copy.product;
  if (kind === "booking_question") return copy.booking;
  if (kind === "unclear") return copy.unclear;
  return null;
}
