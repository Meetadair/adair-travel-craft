import { describe, expect, it } from "vitest";
import {
  changeQuote,
  changeSentence,
  conditionsSentences,
  differenceSentence,
  type ChangeTrip,
} from "./change";

const trip: ChangeTrip = {
  originCity: "Warsaw",
  destinationCity: "Barcelona",
  startDate: "2026-05-04",
  endDate: "2026-05-08",
  stayName: "Hotel Neri",
  passengers: 2,
  hasFlight: true,
  hasStay: true,
  hasCar: true,
};

describe("changeSentence", () => {
  it("keeps everything else when only the dates move", () => {
    const sentence = changeSentence(trip, {
      kind: "dates",
      departDate: "2026-06-01",
      returnDate: "2026-06-05",
    });
    expect(sentence).toContain("Warsaw to Barcelona");
    expect(sentence).toContain("from 2026-06-01");
    expect(sentence).toContain("to 2026-06-05");
    expect(sentence).toContain("for 2 people");
    expect(sentence).toContain("staying at Hotel Neri");
    expect(sentence).toContain("with a car");
  });

  it("keeps the dates when only the hotel changes", () => {
    const sentence = changeSentence(trip, { kind: "stay", stayName: "Casa Bonay" });
    expect(sentence).toContain("from 2026-05-04");
    expect(sentence).toContain("staying at Casa Bonay");
    expect(sentence).not.toContain("Hotel Neri");
  });

  it("leaves out a hotel and a car the trip never had", () => {
    const flightOnly = changeSentence(
      { ...trip, hasStay: false, hasCar: false, passengers: 1 },
      { kind: "dates", departDate: "2026-06-01", returnDate: "2026-06-05" },
    );
    expect(flightOnly).not.toContain("hotel");
    expect(flightOnly).not.toContain("car");
    expect(flightOnly).not.toContain("people");
  });
});

describe("changeQuote", () => {
  it("shows a more expensive change", () => {
    const quote = changeQuote(800, 950, 20);
    expect(quote.differenceEur).toBe(150);
    expect(quote.payableNowEur).toBe(950);
    expect(quote.refundEur).toBe(780);
    expect(differenceSentence(quote)).toBe("This change costs 150.00 EUR more.");
  });

  it("shows a cheaper change", () => {
    const quote = changeQuote(800, 700, 20);
    expect(quote.differenceEur).toBe(-100);
    expect(differenceSentence(quote)).toBe("This change is 100.00 EUR cheaper.");
  });

  it("never refunds below zero", () => {
    expect(changeQuote(10, 500, 40).refundEur).toBe(0);
  });
});

describe("conditionsSentences", () => {
  it("states the fee, the amount payable and the refund timing when rebooking", () => {
    const quote = changeQuote(800, 950, 20);
    const lines = conditionsSentences("dates", "cancel-and-rebook", quote);
    expect(lines.join(" ")).toContain("950.00 EUR for the new booking now");
    expect(lines.join(" ")).toContain("change fee of 20.00 EUR");
    expect(lines.join(" ")).toContain("5 to 10 working days");
  });

  it("says the reference is kept when the supplier changes the booking", () => {
    const lines = conditionsSentences("stay", "supplier-change", changeQuote(800, 820, 0));
    expect(lines[0]).toContain("same reference");
    expect(lines.join(" ")).not.toContain("cancel");
  });
});
