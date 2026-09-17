import { describe, expect, it } from "vitest";
import { buildAdvice } from "./advice";

describe("advice from real card data", () => {
  it("suggests a transfer when the hotel is far and has no garage", () => {
    const lines = buildAdvice({
      hotel: { airportMinutes: 15, hasParking: false },
      car: { priceEur: 120 },
      transferEur: 60,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toContain("15 minutes");
    expect(lines[0]?.text).toContain("€60");
    expect(lines[0]?.action?.kind).toBe("swap_car_for_transfer");
  });

  it("says nothing about the car when the hotel has parking", () => {
    const lines = buildAdvice({
      hotel: { airportMinutes: 15, hasParking: true },
      car: { priceEur: 120 },
    });
    expect(lines).toHaveLength(0);
  });

  it("mentions breakfast only when the rate excludes it and the price is known", () => {
    expect(
      buildAdvice({ hotel: { breakfastIncluded: false, breakfastExtraEur: 18 } })[0]?.text,
    ).toContain("€18");
    expect(buildAdvice({ hotel: { breakfastIncluded: true, breakfastExtraEur: 18 } })).toHaveLength(
      0,
    );
    expect(
      buildAdvice({ hotel: { breakfastIncluded: false, breakfastExtraEur: null } }),
    ).toHaveLength(0);
  });

  it("surfaces a tight arrival with the calmer flight and its cost", () => {
    const lines = buildAdvice({
      arrival: {
        tight: true,
        landAtLabel: "14:10",
        meetingAtLabel: "15:00",
        safer: { title: "11:20", spareLabel: "2h", extraEur: 40, index: 1 },
      },
    });
    expect(lines[0]?.text).toBe(
      "This flight lands at 14:10 for a 15:00 meeting — tight. The 11:20 gives you 2h for €40 more.",
    );
    expect(lines[0]?.action).toEqual({
      kind: "take_earlier_flight",
      label: "Take the earlier flight",
      index: 1,
    });
  });

  it("turns peak pricing into a sentence with an action", () => {
    const line = buildAdvice({
      price: { peak: true, ratio: 2.4, savingEur: 340, offsetDays: 7, eventName: "trade fair" },
    })[0];
    expect(line?.text).toBe(
      "Prices are 2.4× the usual — trade fair week. 7 days later saves €340.",
    );
    expect(line?.action?.kind).toBe("show_cheaper_dates");
  });

  it("caps at the two most valuable lines", () => {
    const lines = buildAdvice({
      hotel: {
        airportMinutes: 20,
        hasParking: false,
        breakfastIncluded: false,
        breakfastExtraEur: 18,
      },
      car: { priceEur: 100 },
      price: { peak: true, ratio: 2, savingEur: 200, offsetDays: 7, eventName: null },
      arrival: {
        tight: true,
        landAtLabel: "14:10",
        meetingAtLabel: "15:00",
        safer: { title: "11:20", spareLabel: "2h", extraEur: 40, index: 1 },
      },
    });
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.kind)).toEqual(["tight_flight", "peak_prices"]);
  });
});
