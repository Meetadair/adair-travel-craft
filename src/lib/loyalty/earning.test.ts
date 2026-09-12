import { describe, expect, it } from "vitest";
import { DEFAULT_EARNING_RULES, earnsOn } from "./earning";

describe("earnsOn — airlines", () => {
  it("credits Miles & More on a LOT flight, not only Lufthansa", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "miles_more", "LO")).toBe(true);
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "miles_more", "LH")).toBe(true);
  });
  it("does not credit Miles & More on Air France", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "miles_more", "AF")).toBe(false);
  });
  it("credits Flying Blue on KLM and Avios on Aer Lingus", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "flying_blue", "KL")).toBe(true);
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "executive_club", "EI")).toBe(true);
  });
  it("is false for an unknown carrier or missing carrier", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "miles_more", "ZZ")).toBe(false);
    expect(earnsOn(DEFAULT_EARNING_RULES, "airline", "miles_more", null)).toBe(false);
  });
});

describe("earnsOn — hotels and cars", () => {
  it("matches Bonvoy across its brands", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "hotel", "marriott_bonvoy", "Le Meridien Warsaw")).toBe(
      true,
    );
    expect(earnsOn(DEFAULT_EARNING_RULES, "hotel", "marriott_bonvoy", "Hotel Bristol")).toBe(false);
  });
  it("matches Hertz Gold on Thrifty and Avis Preferred on Budget", () => {
    expect(earnsOn(DEFAULT_EARNING_RULES, "car", "hertz_gold", "Thrifty · Compact")).toBe(true);
    expect(earnsOn(DEFAULT_EARNING_RULES, "car", "avis_preferred", "Budget · Estate")).toBe(true);
    expect(earnsOn(DEFAULT_EARNING_RULES, "car", "sixt_card", "Europcar · Estate")).toBe(false);
  });
});
