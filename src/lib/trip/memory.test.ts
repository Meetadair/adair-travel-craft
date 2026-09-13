import { describe, expect, it } from "vitest";
import {
  ASK_CONFIDENCE,
  detectPatterns,
  EVIDENCE_THRESHOLD,
  knowsSentences,
  mergePatterns,
  patternToAsk,
  placeKey,
  resolvePreferences,
  sameAgainQuestion,
  type BookingFact,
  type Pattern,
  type PlaceMemory,
} from "./memory";
import { NO_LEARNING, type StatedPrefs } from "./learning";

const fact = (over: Partial<BookingFact> = {}): BookingFact => ({
  airline: "Lufthansa",
  hotelChain: null,
  carBrand: null,
  departHour: 8,
  connections: 0,
  leadDays: 70,
  nights: 3,
  spendEur: 1200,
  ...over,
});

const stated: StatedPrefs = {
  airlines: [],
  hotelChains: [],
  carBrands: [],
  carCompanies: [],
  dealbreakers: [],
};

const stay = (over: Partial<PlaceMemory> = {}): PlaceMemory => ({
  place: "st. moritz",
  itemKind: "hotel",
  itemRef: null,
  itemName: "The Grace",
  timesChosen: 3,
  lastChosenAt: "2026-01-01T00:00:00Z",
  source: "booked",
  ...over,
});

describe("place memory", () => {
  it("keys on the city, and falls back to the airport code", () => {
    expect(placeKey("St. Moritz")).toBe("st. moritz");
    expect(placeKey(null, "zrh")).toBe("ZRH");
  });

  it("proposes the hotel they keep going back to, and says so", () => {
    const asked = sameAgainQuestion([stay()], "st. moritz", "St. Moritz", {
      sameAgain: "You stayed at {hotel} last time in {city} — same again?",
      full: "",
    });
    expect(asked?.hotel).toBe("The Grace");
    expect(asked?.question).toBe("You stayed at The Grace last time in St. Moritz — same again?");
  });

  it("ignores memory from another city", () => {
    expect(sameAgainQuestion([stay()], "milan", "Milan", { sameAgain: "x", full: "" })).toBeNull();
  });

  it("ranks the most-chosen hotel first for this city", () => {
    const resolved = resolvePreferences(
      stated,
      [],
      [stay({ itemName: "The Grace", timesChosen: 3 }), stay({ itemName: "Kulm", timesChosen: 1 })],
      "st. moritz",
    );
    expect(resolved.rememberedHotels).toEqual(["The Grace", "Kulm"]);
  });
});

describe("patterns from behaviour", () => {
  it("only detects a habit at the evidence threshold", () => {
    const two = detectPatterns([fact(), fact()]);
    expect(two.find((p) => p.patternKind === "airline")).toBeUndefined();
    const three = detectPatterns([fact(), fact(), fact()]);
    const airline = three.find((p) => p.patternKind === "airline");
    expect(airline?.value).toBe("Lufthansa");
    expect(airline?.evidenceCount).toBe(EVIDENCE_THRESHOLD);
    expect(airline?.status).toBe("suggested");
  });

  it("reads timing and lead time from real bookings", () => {
    const found = detectPatterns([fact(), fact(), fact()]);
    expect(found.map((p) => p.patternKind)).toContain("morning_departure");
    expect(found.map((p) => p.patternKind)).toContain("no_connections");
    expect(found.map((p) => p.patternKind)).toContain("lead_time_early");
  });

  it("asks once, and never asks again once answered", () => {
    const detected = detectPatterns([fact(), fact(), fact()]);
    const ask = patternToAsk(detected);
    expect(ask?.patternKind).toBe("airline");
    expect(ask!.confidence).toBeGreaterThanOrEqual(ASK_CONFIDENCE);

    const answered = detected.map((p) => ({ ...p, status: "rejected" as const }));
    expect(patternToAsk(answered)).toBeNull();

    const alreadyAsked = detected.map((p) => ({ ...p, askedAt: "2026-01-01T00:00:00Z" }));
    expect(patternToAsk(alreadyAsked)).toBeNull();
  });

  it("keeps a rejected habit rejected when the evidence grows", () => {
    const existing: Pattern[] = [
      {
        patternKind: "airline",
        value: "Lufthansa",
        confidence: 1,
        evidenceCount: 3,
        status: "rejected",
      },
    ];
    const merged = mergePatterns(existing, detectPatterns([fact(), fact(), fact(), fact()]));
    const airline = merged.find((p) => p.patternKind === "airline")!;
    expect(airline.status).toBe("rejected");
    expect(patternToAsk(merged)?.patternKind).not.toBe("airline");
  });
});

describe("precedence", () => {
  const confirmed: Pattern[] = [
    {
      patternKind: "airline",
      value: "lufthansa",
      confidence: 1,
      evidenceCount: 5,
      status: "confirmed",
    },
  ];

  it("puts what they said first, then confirmed habits, then place memory", () => {
    const resolved = resolvePreferences(
      { ...stated, airlines: ["lot"] },
      confirmed,
      [stay({ itemKind: "airline", itemName: "swiss" })],
      "st. moritz",
    );
    expect(resolved.airlines).toEqual(["lot", "lufthansa", "swiss"]);
    expect(resolved.reasons.map((r) => r.from)).toEqual(["stated", "pattern", "place"]);
  });

  it("never lets a habit or a memory contradict a dealbreaker", () => {
    const resolved = resolvePreferences(
      { ...stated, dealbreakers: ["Lufthansa", "The Grace"] },
      confirmed,
      [stay()],
      "st. moritz",
    );
    expect(resolved.airlines).toEqual([]);
    expect(resolved.rememberedHotels).toEqual([]);
  });

  it("a learned ranking weight never removes something stated", () => {
    const learned = {
      ...NO_LEARNING,
      avoid: [{ kind: "flight" as const, brandId: "lufthansa", times: 3 }],
    };
    const resolved = resolvePreferences(
      { ...stated, airlines: ["lufthansa"] },
      [],
      [],
      "milan",
      learned,
    );
    expect(resolved.airlines).toEqual(["lufthansa"]);
  });

  it("a suggested habit is not acted on until they say yes", () => {
    const suggested = confirmed.map((p) => ({ ...p, status: "suggested" as const }));
    expect(resolvePreferences(stated, suggested, [], "milan").airlines).toEqual([]);
  });
});

describe("what Adair knows about you", () => {
  it("lists confirmed habits, place memory and ranking lines in plain words", () => {
    const lines = knowsSentences(
      [
        {
          patternKind: "airline",
          value: "Lufthansa",
          confidence: 1,
          evidenceCount: 4,
          status: "confirmed",
        },
        {
          patternKind: "hotel_chain",
          value: "Kempinski",
          confidence: 0.7,
          evidenceCount: 3,
          status: "suggested",
        },
      ],
      [stay()],
      ["you tend to prefer the better price"],
    );
    expect(lines.map((l) => l.group)).toEqual(["pattern", "place", "ranking"]);
    expect(lines[0]!.text).toBe("you usually fly Lufthansa — from 4 trips");
    expect(lines[1]!.text).toBe("st. moritz — The Grace, 3 times");
    expect(lines[1]!.id).toBe("place:st. moritz:hotel:The Grace");
  });
});
