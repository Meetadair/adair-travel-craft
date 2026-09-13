import { describe, expect, it } from "vitest";

import { buildFlightOptions, durationMinutes, MAX_OPTIONS } from "./flight-options";
import type { FlightResult } from "./types";

const base: FlightResult = {
  carrier: "LOT Polish Airlines",
  flightNumbers: ["LO391"],
  departAt: "2026-10-01T07:00:00",
  arriveAt: "2026-10-01T09:10:00",
  returnDepartAt: "2026-10-03T18:00:00",
  cabin: "economy",
  stops: 0,
  amount: 340,
  currency: "EUR",
  amountEur: 340,
  approx: false,
  offerId: "off_lot",
  expiresAt: null,
  originIata: "WAW",
  destinationIata: "MXP",
  checkedBags: 1,
  checkedBagPriceEur: null,
  changeable: true,
  refundable: true,
};

const lowCost = (over: Partial<FlightResult> = {}): FlightResult => ({
  ...base,
  carrier: "Wizz Air",
  flightNumbers: ["W61234"],
  amount: 110,
  amountEur: 110,
  offerId: "off_wizz",
  checkedBags: 0,
  checkedBagPriceEur: 45,
  changeable: false,
  refundable: false,
  ...over,
});

describe("durationMinutes", () => {
  it("measures the outbound journey", () => {
    expect(durationMinutes(base)).toBe(130);
  });

  it("returns null when the times make no sense", () => {
    expect(durationMinutes({ ...base, arriveAt: "not-a-time" })).toBeNull();
  });
});

describe("buildFlightOptions", () => {
  it("returns nothing when there is no flight", () => {
    expect(buildFlightOptions(null, []).options).toEqual([]);
  });

  it("never shows more than three", () => {
    const many = [
      lowCost({ offerId: "a", carrier: "Ryanair", amountEur: 100 }),
      lowCost({ offerId: "b", carrier: "easyJet", amountEur: 120 }),
      lowCost({ offerId: "c", carrier: "Vueling", amountEur: 130 }),
      lowCost({ offerId: "d", carrier: "Transavia", amountEur: 140 }),
    ];
    expect(buildFlightOptions(base, many).options.length).toBeLessThanOrEqual(MAX_OPTIONS);
  });

  it("marks exactly one option as the recommendation", () => {
    const { options } = buildFlightOptions(base, [lowCost()]);
    expect(options.filter((o) => o.recommended)).toHaveLength(1);
    expect(options[0]?.recommended).toBe(true);
  });

  it("names the bag cost alongside the price difference", () => {
    const { options } = buildFlightOptions(base, [lowCost()]);
    const cheap = options[1];
    expect(cheap?.deltaEur).toBe(-230);
    // €230 cheaper on the fare, but €45 goes back on for the bag.
    expect(cheap?.effectiveDeltaEur).toBe(-185);
    expect(cheap?.costsLater.join(" ")).toMatch(/checked bag not included, €45/);
  });

  it("says so plainly when the bag price is unknown", () => {
    const { options } = buildFlightOptions(base, [lowCost({ checkedBagPriceEur: null })]);
    expect(options[1]?.hasUnpricedCost).toBe(true);
    expect(options[1]?.costsLater.join(" ")).toMatch(/has not published the price/);
  });

  it("names a different airport as a cost, not a detail", () => {
    const { options } = buildFlightOptions(base, [
      lowCost({ destinationIata: "BGY", checkedBagPriceEur: 45 }),
    ]);
    expect(options[1]?.costsLater.join(" ")).toMatch(/lands at BGY, not MXP/);
    expect(options[1]?.hasUnpricedCost).toBe(true);
  });

  it("counts connections and a longer journey against the cheaper fare", () => {
    const slow = lowCost({ stops: 1, arriveAt: "2026-10-01T13:00:00" });
    const { options } = buildFlightOptions(base, [slow]);
    const lines = options[1]?.costsLater.join(" ") ?? "";
    expect(lines).toMatch(/one connection/);
    expect(lines).toMatch(/longer/);
  });

  it("records non-refundable and non-changeable fares", () => {
    const { options } = buildFlightOptions(base, [lowCost()]);
    const lines = options[1]?.costsLater.join(" ") ?? "";
    expect(lines).toMatch(/non-refundable/);
    expect(lines).toMatch(/cannot be changed/);
  });

  it("credits the traveller's own airline and an included bag", () => {
    const { options } = buildFlightOptions(base, [lowCost()], {
      airlines: ["lot"],
      loyaltyCarriers: ["LOT"],
    });
    const gives = options[0]?.gives.join(" ") ?? "";
    expect(gives).toMatch(/your airline/);
    expect(gives).toMatch(/bag included/);
    expect(gives).toMatch(/earns miles/);
  });

  it("drops an alternative that is the same airline at the same price", () => {
    const twin = { ...base, offerId: "off_twin", flightNumbers: ["LO393"] };
    expect(buildFlightOptions(base, [twin]).options).toHaveLength(1);
  });

  it("keeps a same-price alternative when the airline differs", () => {
    const other = { ...base, carrier: "Lufthansa", offerId: "off_lh" };
    expect(buildFlightOptions(base, [other]).options).toHaveLength(2);
  });

  it("recommends the low-cost when it is genuinely cheaper all in", () => {
    const cheapAllIn = lowCost({ checkedBags: 1, checkedBagPriceEur: null, amountEur: 110 });
    const { recommendation } = buildFlightOptions(base, [cheapAllIn]);
    expect(recommendation).toMatch(/Wizz Air/);
    expect(recommendation).toMatch(/€230 less/);
  });

  it("warns when the saving disappears once the extras are in", () => {
    const barelyCheaper = lowCost({ amountEur: 325, checkedBagPriceEur: 45 });
    const { recommendation } = buildFlightOptions(base, [barelyCheaper]);
    expect(recommendation).toMatch(/back where you started/);
  });

  it("never states a saving without naming what it costs later", () => {
    const { options, recommendation } = buildFlightOptions(base, [lowCost()]);
    const cheaper = options.find((o) => o.deltaEur < 0);
    expect(cheaper?.costsLater.length).toBeGreaterThan(0);
    expect(recommendation.length).toBeGreaterThan(0);
  });
});
