/**
 * Business or leisure — and what that does to preferences.
 *
 * The same person is two travellers. The base preferences are who they are;
 * the business overlay is only what changes when the company pays: the cabin,
 * the kind of hotel, how far from the meeting it may be. An empty overlay
 * means work trips simply use the base — nobody is made to answer a second
 * questionnaire before they can book.
 *
 * Detection is honest about its limits: it reads what the sentence and the
 * request actually say, and when neither says anything, the trip is leisure.
 * Guessing "business" would put someone's weekend in a airport chain hotel.
 */

export type TripContext = "business" | "leisure";

/**
 * The fields the overlay may change.
 *
 * This list used to be twelve hand-picked fields, and every question outside it
 * was the same answer for both lives: one hotel standard, one travel style, one
 * rhythm. That is wrong in an obvious way — a gym in Frankfurt and a pool in
 * Crete, shortest-door-to-door on Tuesday and the place itself in August — and
 * it quietly made both searches worse, because whichever answer was given had
 * to serve the other trip too.
 *
 * So the overlay now covers the questionnaire. Nothing here is required: a
 * field nobody answered for work still falls through to the person.
 */
export const BUSINESS_OVERRIDE_FIELDS = [
  "cabinClass",
  "cabinRule",
  "seat",
  "seatFront",
  "seatLegroom",
  "maxConnections",
  "airlines",
  "hotelTypes",
  "hotelChains",
  "hotelStars",
  "hotelMinRating",
  "hotelRatingLevel",
  "hotelAmenities",
  "hotelMaxKm",
  "hotelRules",
  "carBrands",
  "carClass",
  "carCompanies",
  "carTransmission",
  "carNavigation",
  "carChildSeat",
  "budgetBand",
  "dealbreakers",
  /**
   * Everything the part-2 questionnaire stores as free answers — travel style,
   * rhythm, interests. Merged key by key, so answering one of them for work
   * does not wipe the others.
   */
  "extraAnswers",
] as const;

export type BusinessOverrideField = (typeof BUSINESS_OVERRIDE_FIELDS)[number];

export type BusinessPrefs = Partial<Record<BusinessOverrideField, unknown>>;

const WORK_WORDS =
  /\b(meeting|client|conference|business|work trip|praca|s[łl]u[żz]bow|spotkanie|klient|konferencj|delegacj|termin|kunde|gesch[äa]ft)\b/i;

const LEISURE_WORDS =
  /\b(holiday|vacation|honeymoon|anniversary|weekend away|beach|wakacj|urlop|odpoczynek|rocznic|plaż|plaz)\b/i;

/**
 * What kind of trip the sentence describes.
 *
 * The explicit signals win, in order: an invoice to a company is business no
 * matter how the sentence reads; leisure words beat work words because "beach
 * after the conference" is a holiday with a meeting attached, not the other
 * way round; and silence is leisure.
 */
export function detectTripContext(
  sentence: string,
  request?: {
    invoiceToCompany?: boolean;
    mustArriveBy?: string | null;
    /** What the traveller answered when asked outright. Nothing beats this. */
    purpose?: "business" | "personal" | null;
  } | null,
): TripContext {
  // Adair now asks whether a trip is for work, and a stated answer settles it.
  // Guessing from the wording after the person has already told us was how an
  // anniversary in Vienna got booked on the work profile because it mentioned
  // a conference centre nearby.
  if (request?.purpose === "business") return "business";
  if (request?.purpose === "personal") return "leisure";
  if (request?.invoiceToCompany) return "business";
  if (LEISURE_WORDS.test(sentence)) return "leisure";
  if (WORK_WORDS.test(sentence)) return "business";
  // A hard arrival time with none of the words is a meeting in disguise.
  if (request?.mustArriveBy) return "business";
  return "leisure";
}

/** True when the overlay actually changes something. */
export function hasBusinessOverrides(overlay: BusinessPrefs | null | undefined): boolean {
  if (!overlay) return false;
  return Object.values(overlay).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "",
  );
}

/**
 * The preferences a search should use for this trip.
 *
 * Field by field: an overlay value that says something replaces the base; an
 * empty one falls through. The base object is never mutated, and on a leisure
 * trip the overlay is not consulted at all.
 */
export function prefsForContext<T extends Record<string, unknown>>(
  base: T,
  overlay: BusinessPrefs | null | undefined,
  context: TripContext,
): T {
  if (context !== "business" || !overlay) return base;

  const merged: Record<string, unknown> = { ...base };
  for (const field of BUSINESS_OVERRIDE_FIELDS) {
    const value = overlay[field];

    // extraAnswers is a bag of separate answers, so it merges key by key.
    // Replacing it wholesale would erase the rhythm because someone set a
    // travel style for work.
    if (field === "extraAnswers") {
      const work = value as Record<string, string[]> | undefined;
      if (!work || Object.keys(work).length === 0) continue;
      const baseExtra = (base["extraAnswers"] ?? {}) as Record<string, string[]>;
      const mergedExtra: Record<string, string[]> = { ...baseExtra };
      for (const [key, answer] of Object.entries(work)) {
        if (Array.isArray(answer) && answer.length > 0) mergedExtra[key] = answer;
      }
      merged["extraAnswers"] = mergedExtra;
      continue;
    }

    const meaningful = Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined && value !== "";
    if (meaningful) merged[field] = value;
  }
  return merged as T;
}
