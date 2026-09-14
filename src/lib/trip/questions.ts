/**
 * What Adair asks in the chat before searching, with the answer control right
 * under the question. Never more than two questions; non-essential ones may be
 * ignored and the assumption is then printed on the card.
 */
import { MULTI_AIRPORT, hasNoDates, isVagueWeek, mentionsAirport } from "./clarify";
import { calendarDates } from "./parse";
import { ageQuestion, familyFromSentence } from "./family";
import { travellersStated } from "./passengers";
import type { TripRequest } from "./types";

export type ChatQuestionKind =
  | "destination"
  | "dates"
  | "arrival_time"
  | "child_ages"
  | "which_airport"
  | "travellers"
  | "needs_car"
  | "return_time"
  | "airport_transfer";

export type ChatQuestion = {
  kind: ChatQuestionKind;
  /** One short question, in the chat. */
  question: string;
  /** The control shown under it. */
  control: "calendar" | "time" | "ages" | "options" | "travellers" | "destination";
  /** Buttons, for the options control. */
  options: { label: string; value: string }[];
  /** Essential questions block the search; the others only add an assumption. */
  essential: boolean;
};

export type QuestionCopy = {
  destination: string;
  travellers: string;
  dates: string;
  arrivalTime: string;
  whichAirport: string;
  needsCar: string;
  returnTime: string;
  airportTransfer: string;
};

export const QUESTION_COPY: QuestionCopy = {
  destination: "Where are you going?",
  travellers: "Flying solo, or with others?",
  dates: "Which dates?",
  arrivalTime: "What time do you need to be there?",
  whichAirport: "{city} has more than one airport. Which one?",
  needsCar: "Do you want a car there?",
  returnTime: "What time do you want to come back?",
  airportTransfer: "Shall I arrange the transfer from the airport?",
};

/** True when the sentence already settles the car question either way. */
export function mentionsCar(sentence: string): boolean {
  return /\b(car|hire car|rental|rent a car|drive|driving|no car|without a car)\b/i.test(sentence)
    ? true
    : /samoch|auto|wypożycz|bez auta/i.test(sentence);
}

const DAY_TERMS_G =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|poniedzia[łl]ek|wtorek|[śs]rod[aę]|czwartek|pi[ąa]tek|sobot[aę]|niedziel[aę])\b/gi;

const BUSINESS_TERMS =
  /\b(meeting|meetings|conference|congress|client|customer|board|interview|kick-?off|workshop|trade fair|business trip|on business|invoice|vat)\b|spotkanie|spotkani|konferencj|klient|delegacj|faktur/i;

/** True when the trip is for work: a business trip needs an arrival time. */
export function isBusinessSentence(sentence: string, request?: TripRequest | null): boolean {
  if (request?.invoiceToCompany) return true;
  if (request?.meetingLocation) return true;
  return BUSINESS_TERMS.test(sentence);
}

export type QuestionContext = {
  /** Airport codes the traveller has already chosen before. */
  knownAirports?: string[];
  /** Kinds already answered in this conversation. */
  answered?: ChatQuestionKind[];
  copy?: QuestionCopy;
  /**
   * What we already know about this traveller, so we stop asking it.
   *
   * This is how the conversation shortens over time: on the first trip almost
   * nothing is known and we ask properly; by the fifth, most of it is on file
   * and the same sentence goes almost straight to a card.
   */
  known?: KnownProfile;
};

export type KnownProfile = {
  /** Cabin class, seat, hotel type, car — anything they set in preferences. */
  statedPreferences?: number;
  /** Trips already booked. A returning traveller has taught us things. */
  tripsBooked?: number;
  /** True when they have told us whether they usually take a car. */
  knowsCarHabit?: boolean;
  /** True when we know how they like to travel for work. */
  knowsBusinessHabit?: boolean;
};

/**
 * How many questions we may ask in one exchange.
 *
 * A first trip earns four: without them the card is a guess, and a guessed card
 * is what makes someone leave. Once a traveller has booked a few times and
 * filled in preferences, two is plenty, then one. We never go to zero — there
 * is always something only this trip can answer.
 */
export function questionBudget(known: KnownProfile = {}): number {
  const trips = known.tripsBooked ?? 0;
  const stated = known.statedPreferences ?? 0;

  if (trips === 0 && stated < 3) return 4;
  if (trips <= 2 || stated < 8) return 3;
  if (trips <= 5) return 2;
  return 1;
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/**
 * The one or two questions to ask now, most important first.
 * Essential: dates, an arrival time for a business trip, children's ages.
 */
export function chatQuestions(
  sentence: string,
  request: TripRequest,
  context: QuestionContext = {},
): ChatQuestion[] {
  const copy = context.copy ?? QUESTION_COPY;
  const answered = context.answered ?? [];
  const out: ChatQuestion[] = [];

  // Without a destination there is no trip: it is the only question we ask.
  if (!request.destinationCity?.trim()) {
    return [
      {
        kind: "destination",
        question: copy.destination,
        control: "destination",
        options: [],
        essential: true,
      },
    ];
  }

  const ages = ageQuestion(familyFromSentence(sentence));
  if (ages && !answered.includes("child_ages")) {
    out.push({ kind: "child_ages", question: ages, control: "ages", options: [], essential: true });
  }

  // Who's coming shapes everything else — fares, rooms, whether the hotel
  // needs a second bed. Skipped only once the sentence has actually settled
  // it (a number, "solo", one named companion); "with my family" on its own
  // is exactly the vague case this question exists to resolve.
  if (!travellersStated(sentence) && !answered.includes("travellers")) {
    out.push({
      kind: "travellers",
      question: copy.travellers,
      control: "travellers",
      options: [],
      essential: true,
    });
  }

  // Three ways the dates are not settled: none in the sentence, a vague week,
  // or a departure with no way home. All three block the search.
  const returnMissing = !request.returnDate || request.returnDate <= request.departDate;

  // One day named, no range, no nights: the return date on the request is our
  // default, not their decision. Asking beats booking a night they never chose.
  const singleDay =
    (sentence.match(DAY_TERMS_G) ?? []).length === 1 &&
    !/\b(to|until|till|through|do|bis|–|-)\b/i.test(sentence) &&
    !/\b(night|nights|noc|nocy|nächte)\b/i.test(sentence) &&
    calendarDates(sentence, new Date()).length === 0;

  if (
    (hasNoDates(sentence) || isVagueWeek(sentence) || returnMissing || singleDay) &&
    !answered.includes("dates")
  ) {
    out.push({
      kind: "dates",
      question: copy.dates,
      control: "calendar",
      options: [],
      essential: true,
    });
  }

  if (
    isBusinessSentence(sentence, request) &&
    !request.mustArriveBy &&
    !answered.includes("arrival_time")
  ) {
    out.push({
      kind: "arrival_time",
      question: copy.arrivalTime,
      control: "time",
      options: [],
      essential: true,
    });
  }

  const airports = MULTI_AIRPORT[request.destinationCity] ?? [];
  const known = (context.knownAirports ?? []).some((code) =>
    airports.some((a) => a.iata === code.toUpperCase()),
  );
  if (
    airports.length > 1 &&
    !known &&
    !mentionsAirport(sentence, request.destinationCity) &&
    !answered.includes("which_airport")
  ) {
    out.push({
      kind: "which_airport",
      question: fill(copy.whichAirport, { city: request.destinationCity }),
      control: "options",
      options: airports.map((a) => ({ label: a.label, value: a.iata })),
      essential: false,
    });
  }

  // A car changes the whole shape of a trip, and guessing it wrong wastes the
  // search. The request always carries a boolean, so silence in the sentence —
  // not the parsed value — is what tells us the traveller has not decided.
  if (!mentionsCar(sentence) && !answered.includes("needs_car")) {
    out.push({
      kind: "needs_car",
      question: copy.needsCar,
      control: "options",
      options: [
        { label: "Yes, a car", value: "car" },
        { label: "No car", value: "no car" },
      ],
      essential: false,
    });
  }

  // Without a car, someone still has to get them from the airport. Only once
  // they have actually told us they do not want one.
  if (
    !request.needsCar &&
    answered.includes("needs_car") &&
    !answered.includes("airport_transfer")
  ) {
    out.push({
      kind: "airport_transfer",
      question: copy.airportTransfer,
      control: "options",
      options: [
        { label: "Yes, please", value: "with a transfer from the airport" },
        { label: "I'll sort it", value: "no transfer" },
      ],
      essential: false,
    });
  }

  // A business trip has a meeting to reach and a train to catch home.
  if (
    isBusinessSentence(sentence, request) &&
    !request.mustDepartBy &&
    !answered.includes("return_time")
  ) {
    out.push({
      kind: "return_time",
      question: copy.returnTime,
      control: "time",
      options: [],
      essential: false,
    });
  }

  // Destination, then dates, then the arrival time, then anything else.
  const rank: Record<ChatQuestionKind, number> = {
    destination: 0,
    travellers: 1,
    dates: 2,
    arrival_time: 3,
    child_ages: 4,
    which_airport: 5,
    needs_car: 6,
    return_time: 7,
    airport_transfer: 8,
  };
  const profile = context.known ?? {};

  // Anything the profile already answers is not worth a traveller's time.
  const worthAsking = out.filter((question) => {
    if (question.kind === "needs_car" && profile.knowsCarHabit) return false;
    if (question.kind === "return_time" && profile.knowsBusinessHabit) return false;
    return true;
  });

  return worthAsking
    .sort((a, b) => Number(b.essential) - Number(a.essential) || rank[a.kind] - rank[b.kind])
    .slice(0, questionBudget(profile));
}

/** True when nothing essential is missing, so the search may run. */
export function essentialsMet(questions: ChatQuestion[]): boolean {
  return !questions.some((q) => q.essential);
}
