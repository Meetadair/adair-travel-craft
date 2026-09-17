import { describe, expect, it } from "vitest";
import { BRAND_SEED } from "@/lib/brands/catalogue";
import { DEFAULT_EARNING_RULES, earnsOn, earnsOnWithGroup } from "./earning";

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

describe("earnsOnWithGroup — brand table widens the mapping", () => {
  it("credits a hotel programme across its whole group", () => {
    expect(
      earnsOnWithGroup(
        DEFAULT_EARNING_RULES,
        BRAND_SEED,
        "hotel",
        "marriott_bonvoy",
        "The Westin Warsaw",
      ),
    ).toBe(true);
    expect(
      earnsOnWithGroup(
        DEFAULT_EARNING_RULES,
        BRAND_SEED,
        "hotel",
        "marriott_bonvoy",
        "Hotel Bristol",
      ),
    ).toBe(false);
  });
  it("credits an alliance card on any alliance member", () => {
    expect(earnsOnWithGroup(DEFAULT_EARNING_RULES, BRAND_SEED, "airline", "lot_miles", "UA")).toBe(
      true,
    );
    expect(earnsOnWithGroup(DEFAULT_EARNING_RULES, BRAND_SEED, "airline", "lot_miles", "DL")).toBe(
      false,
    );
  });
  it("credits a car programme across its owning group", () => {
    expect(
      earnsOnWithGroup(
        DEFAULT_EARNING_RULES,
        BRAND_SEED,
        "car",
        "avis_preferred",
        "Budget · Estate",
      ),
    ).toBe(true);
  });
});
