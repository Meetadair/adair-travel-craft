import { describe, expect, it } from "vitest";
import { applyHouseStandard, houseBonus, houseQualities } from "./house-standard";

const stay = (name: string, rating: number | null, amenities: string[] = []) =>
  ({
    name,
    address: "",
    rating,
    nightlyAmount: 100,
    amount: 200,
    currency: "EUR",
    amountEur: 200,
    approx: false,
    photoUrl: null,
    rateId: null,
    amenities,
  }) as never;

describe("houseQualities", () => {
  it("reads the name as well as the amenity list", () => {
    expect(houseQualities("Grand Hotel Thermal & Spa")).toContain("spa");
    expect(houseQualities("Hotel Centrale", ["swimming pool", "gym"])).toContain("pool");
  });

  it("survives accents, because Château and Chateau are one hotel", () => {
    expect(houseQualities("Château de Bagnols")).toContain("boutique");
  });

  it("finds water, mountains, horses and golf", () => {
    expect(houseQualities("Lakeside Lodge")).toContain("lake");
    expect(houseQualities("Alpine Retreat")).toContain("mountains");
    expect(houseQualities("The Equestrian Inn")).toContain("horses");
    expect(houseQualities("Old Course Golf Resort")).toContain("golf");
  });

  it("says nothing about a plain hotel rather than inventing a quality", () => {
    expect(houseQualities("Airport Inn Express")).toEqual([]);
  });
});

describe("houseBonus", () => {
  it("rewards a property that carries them", () => {
    expect(houseBonus("Lakeside Spa Resort", ["pool"])).toBeGreaterThan(0);
  });

  it("caps, so a resort brochure does not outrank a good hotel on length", () => {
    const everything = houseBonus("Beach Lake Mountain Golf Spa Equestrian Boutique", ["pool"]);
    expect(everything).toBe(6);
  });

  it("gives nothing to a property with none of them", () => {
    expect(houseBonus("Airport Inn Express")).toBe(0);
  });
});

describe("applyHouseStandard", () => {
  it("drops anything under four", () => {
    const { stays, relaxed } = applyHouseStandard([
      stay("Good", 4.4),
      stay("Thin", 3.1),
      stay("Grim", 2.0),
    ]);
    expect(stays.map((s) => s.name)).toEqual(["Good"]);
    expect(relaxed).toBe(false);
  });

  it("keeps an unrated property: missing data is not evidence of a bad hotel", () => {
    const { stays } = applyHouseStandard([stay("Unrated", null), stay("Grim", 2)]);
    expect(stays.map((s) => s.name)).toEqual(["Unrated"]);
  });

  it("shows the best available rather than an empty page, and says so", () => {
    const { stays, relaxed } = applyHouseStandard([stay("Thin", 3.2), stay("Grim", 2.4)]);
    expect(stays).toHaveLength(2);
    expect(relaxed).toBe(true);
  });

  it("has nothing to relax when the search itself came back empty", () => {
    expect(applyHouseStandard([])).toEqual({ stays: [], relaxed: false });
  });
});
