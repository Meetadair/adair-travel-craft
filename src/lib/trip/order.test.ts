import { describe, expect, it } from "vitest";
import { clarify } from "./clarify";
import { chatQuestions } from "./questions";
import { ruleIntent } from "./intent";
import { parseTripSentence } from "./parse";
import type { TripRequest } from "./types";

const request = (city: string): TripRequest =>
  ({
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: city,
    destinationIata: city ? "LIN" : "",
    departDate: "2026-10-18",
    returnDate: "2026-10-20",
    cabinClass: "economy",
    passengers: 1,
    lat: 0,
    lon: 0,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    needsCar: false,
    invoiceToCompany: false,
  }) as unknown as TripRequest;

describe("question order", () => {
  it("asks for the destination before the dates", () => {
    const ask = clarify("hey", { destinationCity: "" });
    expect(ask?.kind).toBe("needs_destination");
  });

  it("asks for the destination even when a date is given", () => {
    const ask = clarify("tomorrow", { destinationCity: "" });
    expect(ask?.kind).toBe("needs_destination");
  });

  it("asks the destination alone, never a later question with it", () => {
    const questions = chatQuestions("meeting tomorrow", request(""));
    expect(questions.map((q) => q.kind)).toEqual(["destination"]);
  });

  it("asks who's travelling first, then dates before the arrival time", () => {
    const questions = chatQuestions("Milan for a client meeting", request("Milan"));
    const kinds = questions.map((q) => q.kind);
    expect(kinds[0]).toBe("travellers");
    expect(kinds.indexOf("dates")).toBeLessThan(kinds.indexOf("arrival_time"));
  });
});

describe("greeting", () => {
  it("treats hey and cześć as greetings, not trips", () => {
    expect(ruleIntent("hey")).toBe("greeting");
    expect(ruleIntent("cześć")).toBe("greeting");
    expect(ruleIntent("hello")).toBe("greeting");
  });
});

describe("no invented destination", () => {
  it("returns nothing for a sentence with no place", () => {
    expect(parseTripSentence("hey")).toBeNull();
    expect(parseTripSentence("tomorrow")).toBeNull();
    expect(parseTripSentence("tomorrow to friday, two of us")).toBeNull();
  });
});
