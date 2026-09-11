/** Shared shape of the optional travel-insurance offer on a trip card. */

export type InsuranceQuote = {
  /** Nights the premium was calculated for. */
  nights: number;
  passengers: number;
  currency: string;
  /** Our cost before the extras markup. */
  netEur: number;
  /** Traveller-facing price, extras markup included. */
  grossEur: number;
};

export const INSURANCE_DETAIL =
  "Covers trip cancellation, medical emergencies and lost baggage. Full policy terms provided before departure.";

export const INSURANCE_TITLE = "Travel insurance";

export const INSURANCE_NOTE = "Offer — policy issued at launch via partner";
