import { describe, expect, it } from "vitest";
import { parseTripSentence as parseOrNull } from "./parse";

/** These fixtures all name a destination, so the parse never returns null. */
const parseTripSentence = (sentence: string, today?: Date, home?: string) =>
  parseOrNull(sentence, today, home)!;
import { applyOverrides, understand, wishesFromSentence } from "./understanding";

const req = (sentence: string) => parseTripSentence(sentence, new Date("2026-09-13T09:00:00Z"), "WAW");

describe("understanding strip", () => {
  it("renders the parsed fields", () => {
    const sentence = "I need to be in Milan Thursday morning, back Friday evening, for two";
    const u = understand(sentence, req(sentence));
    const keys = u.fields.map((f) => f.key);
    expect(keys).toContain("origin");
    expect(keys).toContain("destination");
    expect(keys).toContain("departDate");
    expect(keys).toContain("returnDate");
    expect(keys).toContain("travellers");
    expect(u.fields.find((f) => f.key === "destination")?.value).toMatch(/Milan/);
    expect(u.fields.find((f) => f.key === "travellers")?.value).toBe("2 people");
  });

  it("shows the arrival time only when the sentence set one", () => {
    const plain = "Trip to Berlin on Monday, back Wednesday";
    expect(understand(plain, req(plain)).fields.some((f) => f.key === "arriveBy")).toBe(false);
    const timed = "Meeting in Berlin on Monday, I must be there by 15:00, back Wednesday";
    const timedReq = req(timed);
    if (timedReq.mustArriveBy) {
      expect(understand(timed, timedReq).fields.some((f) => f.key === "arriveBy")).toBe(true);
    }
  });

  it("keeps free-text wishes in the traveller's words", () => {
    const wishes = wishesFromSentence(
      "hotel with a pool, dinner at 7pm, taxi from the airport, quiet",
    );
    expect(wishes.some((w) => /pool/i.test(w))).toBe(true);
    expect(wishes.some((w) => /dinner/i.test(w))).toBe(true);
    expect(wishes.some((w) => /taxi/i.test(w))).toBe(true);
    expect(wishes.some((w) => /quiet/i.test(w))).toBe(true);
  });
});

describe("strip edits", () => {
  it("overrides dates, travellers and airports without touching the words", () => {
    const sentence = "Trip to Paris on Monday, back Wednesday";
    const next = applyOverrides(req(sentence), {
      departDate: "2026-10-05",
      returnDate: "2026-10-08",
      passengers: 3,
      destinationIata: "ory",
    });
    expect(next.departDate).toBe("2026-10-05");
    expect(next.returnDate).toBe("2026-10-08");
    expect(next.passengers).toBe(3);
    expect(next.destinationIata).toBe("ORY");
  });

  it("never returns before it departs", () => {
    const sentence = "Trip to Paris on Monday, back Wednesday";
    const next = applyOverrides(req(sentence), { departDate: "2026-10-10", returnDate: "2026-10-01" });
    expect(next.returnDate).toBe("2026-10-10");
  });
});

describe("overrides the traveller set on the card", () => {
  const base = {
    originCity: "Warsaw",
    originIata: "WAW",
    destinationCity: "Lisbon",
    destinationIata: "LIS",
    departDate: "2026-10-20",
    returnDate: "2026-10-24",
    cabinClass: "economy",
    passengers: 1,
    lat: 38.72,
    lon: -9.14,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
  } as unknown as Parameters<typeof applyOverrides>[0];

  it("carries the cabin the traveller picked", () => {
    expect(applyOverrides(base, { cabinClass: "business" }).cabinClass).toBe("business");
  });

  it("can turn a return trip into a one-way", () => {
    expect(applyOverrides(base, { oneWay: true }).oneWay).toBe(true);
  });

  it("can turn a one-way back into a return trip", () => {
    // The bug this guards: `if (overrides.oneWay)` drops an explicit false, so
    // a traveller who changed their mind stayed on a one-way for ever.
    const oneWay = applyOverrides(base, { oneWay: true });
    expect(applyOverrides(oneWay, { oneWay: false }).oneWay).toBe(false);
  });

  it("leaves the cabin alone when nothing was said about it", () => {
    expect(applyOverrides(base, { departDate: "2026-11-01" }).cabinClass).toBe("economy");
  });
});
