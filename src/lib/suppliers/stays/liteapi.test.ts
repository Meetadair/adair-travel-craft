import { describe, expect, it } from "vitest";
import { breakfastFrom, cheapestRate, nightsBetween } from "./liteapi";

describe("cheapestRate", () => {
  it("takes the lowest priced rate across every room type", () => {
    const best = cheapestRate({
      roomTypes: [
        { rates: [{ rateId: "a", boardName: "Room Only", retailRate: { total: [{ amount: 420, currency: "EUR" }] } }] },
        { rates: [{ rateId: "b", boardName: "Breakfast", retailRate: { total: [{ amount: 380, currency: "EUR" }] } }] },
      ],
    });
    expect(best?.rateId).toBe("b");
    expect(best?.amount).toBe(380);
  });

  it("ignores a room with no price rather than showing it as free", () => {
    const best = cheapestRate({
      roomTypes: [
        { rates: [{ rateId: "a", retailRate: { total: [{ amount: 0, currency: "EUR" }] } }] },
        { rates: [{ rateId: "b", retailRate: { total: [{ amount: 310, currency: "EUR" }] } }] },
      ],
    });
    expect(best?.rateId).toBe("b");
  });

  it("returns nothing when the hotel has no bookable rate", () => {
    expect(cheapestRate({ roomTypes: [] })).toBeNull();
  });
});

describe("breakfastFrom", () => {
  it("reads the board name rather than assuming", () => {
    expect(breakfastFrom("Breakfast included")).toBe(true);
    expect(breakfastFrom("Room Only")).toBe(false);
    expect(breakfastFrom("Half board")).toBeNull();
    expect(breakfastFrom(null)).toBeNull();
  });
});

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2026-11-10", "2026-11-12")).toBe(2);
  });

  it("never returns zero, so a price is never divided by nothing", () => {
    expect(nightsBetween("2026-11-10", "2026-11-10")).toBe(1);
    expect(nightsBetween("nonsense", "also nonsense")).toBe(1);
  });
});
