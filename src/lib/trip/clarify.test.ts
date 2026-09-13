import { describe, expect, it } from "vitest";
import {
  applyAnswer,
  assumptionNote,
  clarify,
  hasNoDates,
  isVagueWeek,
} from "@/lib/trip/clarify";

describe("ambiguity detection", () => {
  it("spots a sentence with no timing at all", () => {
    expect(hasNoDates("Warsaw to Lisbon, flight and hotel")).toBe(true);
    expect(hasNoDates("Warsaw to Lisbon on Friday")).toBe(false);
    expect(hasNoDates("Lisbon for a weekend")).toBe(false);
    expect(hasNoDates("Lisbon for 3 nights")).toBe(false);
    expect(hasNoDates("Lisbon 12/09")).toBe(false);
  });

  it("spots next week without a day", () => {
    expect(isVagueWeek("Rome next week")).toBe(true);
    expect(isVagueWeek("Rome next week, Tuesday to Thursday")).toBe(false);
    expect(isVagueWeek("Rome on Tuesday")).toBe(false);
  });

  it("asks about dates before anything else", () => {
    const ask = clarify("London, flight and hotel", { destinationCity: "London" });
    expect(ask?.kind).toBe("no_dates");
  });

  it("asks which airport when the city has two and nothing is stored", () => {
    const ask = clarify("Paris on Friday to Sunday", { destinationCity: "Paris" });
    expect(ask?.kind).toBe("which_airport");
    expect(ask?.options.some((o) => o.includes("ORY"))).toBe(true);
  });

  it("does not ask when the airport is named or already known", () => {
    expect(clarify("Paris Orly on Friday", { destinationCity: "Paris" })).toBeNull();
    expect(
      clarify("Paris on Friday", { destinationCity: "Paris", knownAirports: ["ORY"] }),
    ).toBeNull();
  });

  it("asks nothing for a single-airport city with dates", () => {
    expect(clarify("Krakow on Friday for 2 nights", { destinationCity: "Krakow" })).toBeNull();
  });

  it("asks about a hotel wish we could not place", () => {
    const ask = clarify("Rome on Friday", {
      destinationCity: "Rome",
      unresolvedHotel: "Hotel Splendide",
    });
    expect(ask?.kind).toBe("hotel_unmatched");
  });

  it("never asks a second question for the same sentence", () => {
    expect(clarify("London, flight and hotel", { destinationCity: "London", alreadyAsked: true })).toBeNull();
    expect(
      clarify("Paris", {
        destinationCity: "Paris",
        alreadyAsked: true,
        unresolvedHotel: "Hotel X",
      }),
    ).toBeNull();
  });
});

describe("answers and assumptions", () => {
  it("folds the answer back into the sentence", () => {
    expect(applyAnswer("Paris on Friday", "which_airport", "Orly (ORY)")).toBe(
      "Paris on Friday from Orly (ORY)",
    );
    expect(applyAnswer("Paris", "no_dates", "This weekend")).toBe("Paris This weekend");
    expect(applyAnswer("Paris", "no_dates", "  ")).toBe("Paris");
  });

  it("states the assumption when it searched without an answer", () => {
    expect(assumptionNote("Paris on Friday", "Paris", "CDG")).toBe("assumed Paris CDG");
    expect(assumptionNote("Paris Orly on Friday", "Paris", "ORY")).toBeNull();
    expect(assumptionNote("Krakow on Friday", "Krakow", "KRK")).toBeNull();
  });
});
