/**
 * What Adair asks in the chat before searching, with the answer control right
 * under the question. Never more than two questions; non-essential ones may be
 * ignored and the assumption is then printed on the card.
 */
import { MULTI_AIRPORT, hasNoDates, isVagueWeek, mentionsAirport } from "./clarify";
import { ageQuestion, familyFromSentence } from "./family";
import type { TripRequest } from "./types";

export type ChatQuestionKind = "dates" | "arrival_time" | "child_ages" | "which_airport";

export type ChatQuestion = {
  kind: ChatQuestionKind;
  /** One short question, in the chat. */
  question: string;
  /** The control shown under it. */
  control: "calendar" | "time" | "ages" | "options";
  /** Buttons, for the options control. */
  options: { label: string; value: string }[];
  /** Essential questions block the search; the others only add an assumption. */
  essential: boolean;
};

export type QuestionCopy = {
  dates: string;
  arrivalTime: string;
  whichAirport: string;
};

export const QUESTION_COPY: QuestionCopy = {
  dates: "Which dates?",
  arrivalTime: "What time do you need to be there?",
  whichAirport: "{city} has more than one airport. Which one?",
};

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
};

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

  const ages = ageQuestion(familyFromSentence(sentence));
  if (ages && !answered.includes("child_ages")) {
    out.push({ kind: "child_ages", question: ages, control: "ages", options: [], essential: true });
  }

  if ((hasNoDates(sentence) || isVagueWeek(sentence)) && !answered.includes("dates")) {
    out.push({ kind: "dates", question: copy.dates, control: "calendar", options: [], essential: true });
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

  return out.sort((a, b) => Number(b.essential) - Number(a.essential)).slice(0, 2);
}

/** True when nothing essential is missing, so the search may run. */
export function essentialsMet(questions: ChatQuestion[]): boolean {
  return !questions.some((q) => q.essential);
}
