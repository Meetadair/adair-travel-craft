/**
 * Changing a booked trip. Pure helpers: the sentence used to search again, the
 * money maths for the difference, and the plain-language conditions shown
 * before anything is confirmed. No supplier names appear here.
 */

export type ChangeKind = "dates" | "stay";

/**
 * Where the pending change waits between the two pages that carry it out:
 * the change page quotes and books the new trip, then this key tells the
 * booking confirmation to actually release the old one, once payment on the
 * new one clears — never before.
 */
export const CHANGE_STORAGE_KEY = "adair.trip-change";

export type PendingChange = {
  cardId: string;
  oldTripId: string;
  kind: ChangeKind;
  feeEur: number;
};

/** How the change is carried out. */
export type ChangeMethod = "supplier-change" | "cancel-and-rebook";

export type ChangeTrip = {
  originCity: string;
  destinationCity: string;
  startDate: string | null;
  endDate: string | null;
  stayName: string | null;
  passengers: number;
  hasFlight: boolean;
  hasStay: boolean;
  hasCar: boolean;
};

export type ChangeInput = {
  kind: ChangeKind;
  /** New dates, for a date change. */
  departDate?: string | null;
  returnDate?: string | null;
  /** New hotel wish, for a stay change. */
  stayName?: string | null;
};

const dateWord = (value: string | null | undefined): string => value ?? "";

/**
 * Rebuilds the request as a sentence, keeping everything the traveller already
 * booked and replacing only the parameter being changed.
 */
export function changeSentence(trip: ChangeTrip, input: ChangeInput): string {
  const depart = dateWord(input.kind === "dates" ? input.departDate : trip.startDate);
  const ret = dateWord(input.kind === "dates" ? input.returnDate : trip.endDate);
  const stay = input.kind === "stay" ? (input.stayName ?? null) : trip.stayName;

  const parts = [`${trip.originCity} to ${trip.destinationCity}`];
  if (depart) parts.push(`from ${depart}`);
  if (ret) parts.push(`to ${ret}`);
  if (trip.passengers > 1) parts.push(`for ${trip.passengers} people`);
  if (trip.hasStay) parts.push(stay ? `staying at ${stay}` : "with a hotel");
  if (trip.hasCar) parts.push("with a car");
  return parts.join(" ");
}

export type ChangeQuote = {
  oldTotalEur: number;
  newTotalEur: number;
  /** Positive when the change costs more, negative when it costs less. */
  differenceEur: number;
  feeEur: number;
  /** What the traveller pays now: the new trip in full. */
  payableNowEur: number;
  /** What comes back on the original booking, after the fee. */
  refundEur: number;
};

export function changeQuote(oldTotalEur: number, newTotalEur: number, feeEur: number): ChangeQuote {
  const round = (n: number) => Math.round(n * 100) / 100;
  const refund = Math.max(0, round(oldTotalEur - feeEur));
  return {
    oldTotalEur: round(oldTotalEur),
    newTotalEur: round(newTotalEur),
    differenceEur: round(newTotalEur - oldTotalEur),
    feeEur: round(feeEur),
    payableNowEur: round(newTotalEur),
    refundEur: refund,
  };
}

/** Plain words for the difference, shown before the traveller confirms. */
export function differenceSentence(quote: ChangeQuote): string {
  if (quote.differenceEur > 0)
    return `This change costs ${quote.differenceEur.toFixed(2)} EUR more.`;
  if (quote.differenceEur < 0)
    return `This change is ${Math.abs(quote.differenceEur).toFixed(2)} EUR cheaper.`;
  return "This change costs the same as your current booking.";
}

/** The conditions, in plain words, for the method actually available. */
export function conditionsSentences(
  kind: ChangeKind,
  method: ChangeMethod,
  quote: ChangeQuote,
): string[] {
  const what = kind === "dates" ? "dates" : "hotel";
  const lines: string[] = [];

  if (method === "supplier-change") {
    lines.push(`Your booking is changed directly, keeping the same reference.`);
    if (quote.feeEur > 0) lines.push(`A change fee of ${quote.feeEur.toFixed(2)} EUR applies.`);
    lines.push(differenceSentence(quote));
    return lines;
  }

  lines.push(
    `The new ${what} can't be swapped into your existing booking, so we book the new trip and cancel the old one.`,
  );
  lines.push(`You pay ${quote.payableNowEur.toFixed(2)} EUR for the new booking now.`);
  if (quote.feeEur > 0) lines.push(`A change fee of ${quote.feeEur.toFixed(2)} EUR is kept.`);
  lines.push(
    `${quote.refundEur.toFixed(2)} EUR is refunded on the original booking, normally within 5 to 10 working days.`,
  );
  lines.push(differenceSentence(quote));
  return lines;
}

export const CHANGE_REFUND_TIMING = "Refunds normally reach your card within 5 to 10 working days.";
