/**
 * The one question asked at the end of a booking, and what the answers mean.
 *
 * Pure on purpose: the wording lives here, the scale lives here, and both the
 * component and the tests read the same rules. Nothing in this file talks to a
 * network, so what the traveller sees and what we store can never drift apart.
 */

/** The four answers, worst to best. */
export const FEEDBACK_SCALE = [
  { key: "not_satisfied", rating: 1 },
  { key: "satisfied", rating: 2 },
  { key: "good", rating: 3 },
  { key: "fantastic", rating: 4 },
] as const;

export type FeedbackKey = (typeof FEEDBACK_SCALE)[number]["key"];

export type FeedbackCopy = {
  question: string;
  notSatisfied: string;
  satisfied: string;
  good: string;
  fantastic: string;
  /** Invitation to add a line, shown only once a rating has been given. */
  commentPrompt: string;
  commentPlaceholder: string;
  send: string;
  thanks: string;
  /** Shown under a poor rating: a complaint deserves a person, not a thank-you. */
  thanksPoor: string;
};

export const FEEDBACK_COPY: FeedbackCopy = {
  question: "How well did this trip match what you wanted?",
  notSatisfied: "Not satisfied",
  satisfied: "Satisfied",
  good: "Good",
  fantastic: "Fantastic",
  commentPrompt: "Anything we got wrong, or right?",
  commentPlaceholder: "The hotel was further from the office than it looked",
  send: "Send",
  thanks: "Thank you — this is what teaches Adair your taste.",
  thanksPoor: "Thank you for saying so. We read every one of these, and we will come back to you.",
};

const LABEL_KEY: Record<FeedbackKey, keyof FeedbackCopy> = {
  not_satisfied: "notSatisfied",
  satisfied: "satisfied",
  good: "good",
  fantastic: "fantastic",
};

/** The buttons to render, in order, with the copy resolved. */
export function feedbackOptions(
  copy: Partial<FeedbackCopy> = {},
): { key: FeedbackKey; rating: number; label: string }[] {
  const resolved: FeedbackCopy = { ...FEEDBACK_COPY, ...copy };
  return FEEDBACK_SCALE.map((option) => ({
    key: option.key,
    rating: option.rating,
    label: String(resolved[LABEL_KEY[option.key]]),
  }));
}

export function ratingOf(key: FeedbackKey): number {
  return FEEDBACK_SCALE.find((option) => option.key === key)?.rating ?? 0;
}

/**
 * True when the answer is one we owe a reply to rather than a thank-you.
 *
 * "Satisfied" counts. Someone who books a trip, is asked how it went and
 * answers only "satisfied" has told us something went wrong that they did not
 * think worth typing out — on a product whose whole promise is that the trip
 * matches what they wanted, that is a miss, not a pass.
 */
export function needsFollowUp(key: FeedbackKey): boolean {
  return ratingOf(key) <= 2;
}
