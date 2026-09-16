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

/**
 * Whether Adair may sell travel insurance at all.
 *
 * False until there is a signed underwriter. Until then the line was going
 * onto the trip card as `confirmed`, with a price in the total and on the VAT
 * invoice, while no policy existed and no number could be given — the
 * traveller paid for cover they did not have and would only find out on the
 * day of a claim. Flip this to true in the same change that wires the real
 * insurer, never before.
 */
export const INSURANCE_AVAILABLE = false;
