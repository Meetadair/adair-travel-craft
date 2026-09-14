import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isOneWay, parseTripSentence } from "./parse";

describe("isOneWay", () => {
  it("only fires when the traveller says it outright", () => {
    expect(isOneWay("I need a one way flight to New York")).toBe(true);
    expect(isOneWay("one-way to Milan on Thursday")).toBe(true);
    expect(isOneWay("Berlin Tuesday, no return")).toBe(true);
    expect(isOneWay("lot do Mediolanu w jedną stronę")).toBe(true);
    expect(isOneWay("Rzym w czwartek, bez powrotu")).toBe(true);
    expect(isOneWay("Madryt, tylko tam")).toBe(true);
  });

  it("never infers a one-way from a missing return date", () => {
    // The whole point: people leave the return out and still mean a round trip.
    expect(isOneWay("I need to flight to new york")).toBe(false);
    expect(isOneWay("Milan Thursday to Sunday")).toBe(false);
    expect(isOneWay("Berlin next week")).toBe(false);
    // "away" contains no one-way phrase; guard against a sloppy regex.
    expect(isOneWay("two weeks away in Rome")).toBe(false);
  });
});

describe("parseTripSentence with a one-way", () => {
  it("flags it and collapses the return onto the outbound date", () => {
    const round = parseTripSentence("Milan Thursday to Sunday");
    expect(round?.oneWay).toBeUndefined();
    expect(round && round.returnDate >= round.departDate).toBe(true);

    const single = parseTripSentence("Milan on Thursday, one way");
    expect(single?.oneWay).toBe(true);
    expect(single?.returnDate).toBe(single?.departDate);
  });
});

describe("Duffel request shape", () => {
  const calls: Array<{ url: string; body: unknown }> = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_x");
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, json: async () => ({ data: { offers: [] } }) } as unknown as Response;
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const base = {
    originCity: "Warsaw", originIata: "WAW",
    destinationCity: "New York", destinationIata: "JFK",
    departDate: "2026-10-01", returnDate: "2026-10-08",
  };

  it("sends two slices for a round trip and one for a one-way", async () => {
    const { searchTrip } = await import("@/lib/travel-search.server");

    await searchTrip(base);
    const round = calls.find((c) => c.url.includes("/air/offer_requests"));
    expect((round?.body as { data: { slices: unknown[] } }).data.slices).toHaveLength(2);

    calls.length = 0;
    await searchTrip({ ...base, oneWay: true });
    const single = calls.find((c) => c.url.includes("/air/offer_requests"));
    const slices = (single?.body as { data: { slices: Array<{ origin: string }> } }).data.slices;
    expect(slices).toHaveLength(1);
    expect(slices[0]?.origin).toBe("WAW");
  });

  it("never asks Duffel for a hotel on a one-way", async () => {
    const { searchTrip } = await import("@/lib/travel-search.server");
    const result = await searchTrip({ ...base, oneWay: true });
    expect(calls.some((c) => c.url.includes("/stays/"))).toBe(false);
    expect(result.offers.map((o) => o.kind)).toEqual(["flight"]);
  });
});
