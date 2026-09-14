import { describe, expect, it } from "vitest";
import { bookableLines, bookableTotalMinor, unsellableKinds } from "./bookable-total";

const priced = { flight: 226, stay: 480, car: 140, total: 846 };

describe("what the card may be charged", () => {
  it("does not authorise money for a hotel no supplier will sell", () => {
    // Duffel Stays is not enabled on the account, so the stay has no rate id.
    // The intent used to be opened for the whole 846 regardless.
    const search = { flight: { offerId: "off_123" }, stay: { rateId: null }, car: null };
    expect(bookableTotalMinor(priced, search)).toBe(22_600);
  });

  it("authorises everything when every line is sellable", () => {
    const search = {
      flight: { offerId: "off_123" },
      stay: { rateId: "rat_9" },
      car: { quoteId: "qt_4" },
    };
    expect(bookableTotalMinor(priced, search)).toBe(84_600);
  });

  it("accepts either identifier a car may carry", () => {
    expect(bookableTotalMinor({ car: 140 }, { car: { offerId: "off_c" } })).toBe(14_000);
    expect(bookableTotalMinor({ car: 140 }, { car: { quoteId: "qt_c" } })).toBe(14_000);
    expect(bookableTotalMinor({ car: 140 }, { car: {} })).toBe(0);
  });

  it("treats a blank identifier as no identifier", () => {
    expect(bookableTotalMinor({ flight: 226 }, { flight: { offerId: "   " } })).toBe(0);
  });

  it("authorises nothing when nothing can be sold", () => {
    expect(bookableTotalMinor(priced, {})).toBe(0);
  });

  it("ignores a negative or broken price rather than subtracting it", () => {
    const search = { flight: { offerId: "off_123" }, stay: { rateId: "rat_9" } };
    expect(bookableTotalMinor({ flight: -50, stay: 480 }, search)).toBe(48_000);
    expect(bookableTotalMinor({ flight: Number.NaN, stay: 480 }, search)).toBe(48_000);
  });

  it("never authorises more than the sum of what it can deliver", () => {
    const search = { flight: { offerId: "off_123" }, stay: { rateId: null } };
    const lines = bookableLines(priced, search);
    const authorised = bookableTotalMinor(priced, search);
    expect(authorised).toBe(Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100));
    expect(authorised).toBeLessThan(Math.round(priced.total * 100));
  });

  it("names what is on the card but cannot be bought", () => {
    const search = { flight: { offerId: "off_123" }, stay: { rateId: null }, car: null };
    expect(unsellableKinds(priced, search)).toEqual(["stay", "car"]);
  });
});
