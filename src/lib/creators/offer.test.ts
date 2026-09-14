import { describe, expect, it } from "vitest";
import {
  OFFER_RATES,
  SAMPLE_TRIP,
  earningOnLineMinor,
  earningOnTripMinor,
  formatMinor,
  SUBSCRIPTION_BOUNTY_MINOR,
} from "./offer";
import { commissionMinor, marginMinor, PAYOUT_MINIMUM_MINOR } from "./commission";

describe("creator offer", () => {
  it("advertises exactly the rates the ledger applies", () => {
    // These mirror the seeded creator_commission_rules rows. If a rule moves in
    // the database and not here, the page lies to creators.
    const bps = Object.fromEntries(OFFER_RATES.map((r) => [r.lineType, r.shareBps]));
    expect(bps).toEqual({ stay: 3000, car: 3000, flight: 2000, extras: 2000 });
    expect(SUBSCRIPTION_BOUNTY_MINOR).toEqual({ select: 1000, signature: 2500 });
  });

  it("never promises more than the ledger would pay on the same line", () => {
    for (const rate of OFFER_RATES) {
      const gross = 100_000;
      const ledger = commissionMinor(marginMinor(gross, null, rate.typicalMarkupBps), rate.shareBps);
      expect(earningOnLineMinor(rate, gross)).toBe(ledger);
    }
  });

  it("pays nothing on a line worth nothing", () => {
    for (const rate of OFFER_RATES) expect(earningOnLineMinor(rate, 0)).toBe(0);
  });

  it("is never a share of the traveller's total", () => {
    // The whole promise: a creator's cut comes out of our margin, so it must
    // stay far below the price the traveller paid.
    const total =
      SAMPLE_TRIP.flightMinor + SAMPLE_TRIP.stayMinor + SAMPLE_TRIP.carMinor + SAMPLE_TRIP.extrasMinor;
    const earned = earningOnTripMinor(SAMPLE_TRIP);
    expect(earned).toBeGreaterThan(0);
    expect(earned).toBeLessThan(total * 0.1);
  });

  it("puts the sample trip within reach of a single payout", () => {
    // Not a promise, a sanity check: if one ordinary trip earned cents, the
    // programme is not worth a creator's time and the rates are wrong.
    expect(earningOnTripMinor(SAMPLE_TRIP) * 5).toBeGreaterThan(PAYOUT_MINIMUM_MINOR);
  });

  it("formats whole amounts without stray decimals", () => {
    expect(formatMinor(5000)).toBe("€50");
    expect(formatMinor(5050)).toBe("€50.50");
  });
});
