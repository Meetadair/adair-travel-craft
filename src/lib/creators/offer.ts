/**
 * The creator offer, in one place.
 *
 * These numbers are the public face of `creator_commission_rules`. They are
 * duplicated here rather than fetched because the page must render for a
 * signed-out visitor, and because a rate we advertise should change on purpose,
 * with a deploy, not silently when someone edits a row.
 *
 * If a rule changes in admin, change it here in the same commit.
 */

import { marginMinor, commissionMinor } from "./commission";

export type OfferRate = {
  /** Matches creator_commission_rules.line_type. */
  lineType: "stay" | "car" | "flight" | "extras";
  label: string;
  shareBps: number;
  /** Typical margin we make on this line, in basis points of the net price. */
  typicalMarkupBps: number;
};

/** Mirrors the seeded rows in creator_commission_rules. */
export const OFFER_RATES: OfferRate[] = [
  { lineType: "stay", label: "Hotels and stays", shareBps: 3000, typicalMarkupBps: 1200 },
  { lineType: "car", label: "Car hire", shareBps: 3000, typicalMarkupBps: 1000 },
  { lineType: "flight", label: "Flights", shareBps: 2000, typicalMarkupBps: 300 },
  { lineType: "extras", label: "Extras and transfers", shareBps: 2000, typicalMarkupBps: 1000 },
];

/** Flat amounts, in minor units, for a traveller who takes a plan. */
export const SUBSCRIPTION_BOUNTY_MINOR: Record<"select" | "signature", number> = {
  select: 1000,
  signature: 2500,
};

/** Days a click is remembered before it stops attributing a new traveller. */
export const ATTRIBUTION_DAYS = 90;

/** Months a traveller keeps earning for the creator who introduced them. */
export const EARNING_WINDOW_MONTHS = 12;

/**
 * What a creator earns on one line at the advertised rate. Takes the traveller's
 * price, derives our margin from the typical markup, then the creator's share of
 * that margin — the same order the ledger uses, so the calculator on the page
 * cannot promise more than the ledger pays.
 */
export function earningOnLineMinor(rate: OfferRate, grossMinor: number): number {
  const margin = marginMinor(grossMinor, null, rate.typicalMarkupBps);
  return commissionMinor(margin, rate.shareBps);
}

export type TripMix = {
  flightMinor: number;
  stayMinor: number;
  carMinor: number;
  extrasMinor: number;
};

/** A whole trip, line by line. Nothing here is a projection — it is arithmetic. */
export function earningOnTripMinor(mix: TripMix): number {
  const by = (t: OfferRate["lineType"]) => OFFER_RATES.find((r) => r.lineType === t)!;
  return (
    earningOnLineMinor(by("flight"), mix.flightMinor) +
    earningOnLineMinor(by("stay"), mix.stayMinor) +
    earningOnLineMinor(by("car"), mix.carMinor) +
    earningOnLineMinor(by("extras"), mix.extrasMinor)
  );
}

/** A plausible mid-range week away, used as the calculator's starting point. */
export const SAMPLE_TRIP: TripMix = {
  flightMinor: 32_000,
  stayMinor: 84_000,
  carMinor: 21_000,
  extrasMinor: 9_000,
};

export function formatMinor(minor: number, currency = "EUR", locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}
