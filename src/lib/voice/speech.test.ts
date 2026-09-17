import { describe, expect, it } from "vitest";
import {
  speakableCard,
  speakableReply,
  spokenDate,
  spokenPrice,
  spokenTime,
  stripScreenFurniture,
} from "./speech";

describe("saying a date the way a person would", () => {
  it("turns an ISO date into words", () => {
    expect(spokenDate("2026-10-20")).toBe("20 October");
    expect(spokenDate("2026-10-20", "pl")).toBe("20 października");
  });

  it("leaves anything that is not a date alone", () => {
    expect(spokenDate("next week")).toBe("next week");
    expect(spokenDate("2026-13-40")).toBe("2026-13-40");
  });
});

describe("saying a price", () => {
  it("drops the cents, which are noise out loud", () => {
    expect(spokenPrice(226.47, "EUR")).toBe("226 euros");
    expect(spokenPrice(1, "EUR")).toBe("1 euro");
  });

  it("uses the right word in Polish", () => {
    expect(spokenPrice(226, "EUR", "pl")).toBe("226 euro");
    expect(spokenPrice(900, "PLN", "pl")).toBe("900 złotych");
  });
});

describe("saying a time", () => {
  it("does not read the colon", () => {
    expect(spokenTime("07:55")).toBe("7 55");
    expect(spokenTime("18:00")).toBe("18 o'clock");
  });
});

describe("leaving the screen furniture on the screen", () => {
  it("drops supplier reference codes", () => {
    // A voice spells these out for about eleven seconds.
    expect(stripScreenFurniture("Lufthansa LH1615 off_0000BAPYPXA7AcbIhW")).toBe(
      "Lufthansa LH1615",
    );
  });

  it("turns separators into something sayable", () => {
    expect(stripScreenFurniture("WAW → LIS")).toBe("WAW to LIS");
    expect(stripScreenFurniture("Warsaw · Lisbon")).toBe("Warsaw. Lisbon");
  });

  it("does not mangle ordinary prose", () => {
    const prose = "I'd take Lufthansa — the better fare conditions.";
    expect(stripScreenFurniture(prose)).toBe("I'd take Lufthansa to the better fare conditions.");
  });
});

describe("a whole reply", () => {
  it("rewrites what is unlistenable and leaves the rest alone", () => {
    const said = speakableReply("Lisbon: 2026-10-20 – 2026-10-24. Your composed trip is below.");
    expect(said).toContain("20 October");
    expect(said).toContain("24 October");
    expect(said).toContain("Your composed trip is below");
    expect(said).not.toContain("2026-10-20");
  });

  it("never invents words the assistant did not say", () => {
    // An assistant that paraphrases itself when spoken is saying two things.
    const original = "I found a Lufthansa flight and a hotel near the station.";
    expect(speakableReply(original)).toBe(original);
  });
});

describe("the card, said out loud", () => {
  const card = {
    originCity: "Warsaw",
    destinationCity: "Lisbon",
    departDate: "2026-10-20",
    returnDate: "2026-10-24",
    carrier: "Lufthansa",
    totalAmount: 226.47,
    currency: "EUR",
  };

  it("says where, when and how much, in that order", () => {
    const said = speakableCard(card);
    expect(said).toBe(
      "Warsaw to Lisbon, 20 October to 24 October. Flying Lufthansa. 226 euros in total.",
    );
  });

  it("does not invent a return date for a one-way", () => {
    const said = speakableCard({ ...card, oneWay: true });
    expect(said).toContain("20 October.");
    expect(said).not.toContain("24 October");
  });

  it("calls a sample a sample, because a voice makes everything sound settled", () => {
    const said = speakableCard({ ...card, hotelName: "Downtown hotel", isSample: true });
    expect(said).toContain("sample");
  });

  it("says it in Polish when the page is Polish", () => {
    const said = speakableCard(card, "pl");
    expect(said).toContain("Warsaw do Lisbon");
    expect(said).toContain("od 20 października do 24 października");
    expect(said).toContain("226 euro");
  });

  it("never reads a reference code aloud", () => {
    expect(speakableCard(card)).not.toMatch(/off_|rat_|ord_/);
  });
});
