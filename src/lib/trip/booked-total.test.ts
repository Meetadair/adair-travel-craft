import { describe, expect, it } from "vitest";
import { chargeableTotalEur, isPurchased, isRequestedOnly, notBookedLines } from "./booked-total";

const line = (status: string, amountEur: number, kind = "stay") => ({ kind, status, amountEur });

describe("what the traveller owes", () => {
  it("does not charge for a hotel that was never booked", () => {
    // The bug: Duffel Stays is not enabled, so the hotel comes back as a
    // requested line — and its full price was going into the total anyway.
    const lines = [line("confirmed", 226, "flight"), line("requested", 480, "stay")];
    expect(chargeableTotalEur(lines)).toBe(226);
  });

  it("does not charge for a car no provider sells through an API", () => {
    const lines = [line("confirmed", 226, "flight"), line("requested", 140, "car")];
    expect(chargeableTotalEur(lines)).toBe(226);
  });

  it("does not charge for a line that failed", () => {
    expect(chargeableTotalEur([line("confirmed", 226, "flight"), line("failed", 480)])).toBe(226);
  });

  it("charges for everything that was actually bought", () => {
    const lines = [line("confirmed", 226, "flight"), line("confirmed", 480, "stay")];
    expect(chargeableTotalEur(lines)).toBe(706);
  });

  it("owes nothing when nothing was bought", () => {
    expect(chargeableTotalEur([line("requested", 480), line("failed", 140)])).toBe(0);
  });

  it("rounds to whole cents rather than carrying a floating-point tail", () => {
    expect(chargeableTotalEur([line("confirmed", 0.1), line("confirmed", 0.2)])).toBe(0.3);
  });

  it("survives a line with a missing amount", () => {
    expect(chargeableTotalEur([line("confirmed", Number.NaN)])).toBe(0);
  });

  it("names what could not be booked, so the confirmation can say so", () => {
    const lines = [line("confirmed", 226, "flight"), line("requested", 480, "stay")];
    expect(notBookedLines(lines).map((l) => l.kind)).toEqual(["stay"]);
  });

  it("knows a requested line is not a purchase", () => {
    expect(isPurchased("requested")).toBe(false);
    expect(isRequestedOnly("requested")).toBe(true);
    expect(isPurchased("confirmed")).toBe(true);
    expect(isRequestedOnly("confirmed")).toBe(false);
  });
});
