import { describe, expect, it } from "vitest";
import { convertAmount } from "./currency-math";

const RATES = { USD: 0.92, GBP: 1.17, PLN: 0.23 };

describe("convertAmount", () => {
  it("returns the amount unchanged when the currencies already match", () => {
    expect(convertAmount(150, "USD", "usd", RATES)).toBe(150);
  });

  it("goes EUR straight through at rate 1", () => {
    expect(convertAmount(100, "EUR", "USD", RATES)).toBeCloseTo(100 / 0.92);
    expect(convertAmount(100, "USD", "EUR", RATES)).toBeCloseTo(92);
  });

  it("converts between two non-EUR currencies via EUR", () => {
    // 100 GBP = 117 EUR = 117/0.23 PLN
    expect(convertAmount(100, "GBP", "PLN", RATES)).toBeCloseTo(117 / 0.23);
  });

  it("is case-insensitive on both sides", () => {
    expect(convertAmount(50, "gbp", "PLN", RATES)).toBeCloseTo(convertAmount(50, "GBP", "pln", RATES));
  });

  it("leaves the amount alone rather than guessing an unknown currency", () => {
    expect(convertAmount(80, "ZZZ", "USD", RATES)).toBe(80);
    expect(convertAmount(80, "USD", "ZZZ", RATES)).toBe(80);
  });
});
