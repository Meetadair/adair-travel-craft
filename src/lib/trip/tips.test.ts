import { describe, expect, it } from "vitest";
import { listTravelTips, parseTravelTips } from "@/lib/trip/tips";

describe("travel tips", () => {
  it("keeps only known categories with real text", () => {
    expect(
      parseTravelTips({
        airport: "  Train from T1, 14 minutes.  ",
        payment: "   ",
        weather: "ignored",
      }),
    ).toEqual({ airport: "Train from T1, 14 minutes." });
  });

  it("returns nothing when no tip is written", () => {
    expect(listTravelTips(null)).toEqual([]);
    expect(listTravelTips({})).toEqual([]);
    expect(listTravelTips({ airport: "" })).toEqual([]);
  });

  it("renders in a fixed order with labels", () => {
    expect(listTravelTips({ avoid: "August", airport: "Bus 61" })).toEqual([
      { key: "airport", label: "Getting from the airport", text: "Bus 61" },
      { key: "avoid", label: "When to avoid", text: "August" },
    ]);
  });
});
