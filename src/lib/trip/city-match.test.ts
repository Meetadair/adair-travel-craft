import { describe, expect, it } from "vitest";
import { findCity } from "./cities";
import { parseTripSentence } from "./parse";

const dest = (s: string) => parseTripSentence(s)?.destinationCity ?? null;

describe("city aliases match whole words only", () => {
  it("does not read a city out of the middle of another word", () => {
    // "rom" sits inside "from". This once sent a San Francisco trip to Rome,
    // and a sentence naming no city at all to Rome as well.
    expect(findCity("i came from nowhere")).toBeNull();
    expect(dest("i came from nowhere")).toBeNull();
    expect(dest("fly to San Francisco from Warsaw")).toBe("San Francisco");
  });

  it("still matches a city that really is named", () => {
    expect(dest("trip to Rome")).toBe("Rome");
    expect(dest("lot do rzymu z warszawy")).toBe("Rome");
    expect(dest("weekend w Berlinie")).toBe("Berlin");
  });

  it("matches multi-word names and Polish inflected forms", () => {
    expect(dest("fly to New York on Friday")).toBe("New York");
    // Polish inflects the destination; the alias is the stem.
    expect(findCity("jadę do rzymu")?.city).toBe("Rome");
    expect(findCity("spotkanie w rzymie")?.city).toBe("Rome");
  });

  it("does not read a city out of a longer unrelated word", () => {
    // "rom" starts "romantic", but four more letters follow, so it is not Rome.
    expect(findCity("a romantic weekend somewhere")).toBeNull();
  });
});

describe("cabin class survives a typo", () => {
  it("reads business even when misspelled", () => {
    const typo = parseTripSentence("Milan Thursday to Sunday, best bussines class");
    expect(typo?.cabinClass).toBe("business");
    const right = parseTripSentence("Milan Thursday to Sunday in business class");
    expect(right?.cabinClass).toBe("business");
    const none = parseTripSentence("Milan Thursday to Sunday");
    expect(none?.cabinClass).toBe("economy");
  });
});

describe("intercontinental destinations resolve", () => {
  it("knows the cities the assistant is asked about", () => {
    for (const [sentence, city] of [
      ["fly to San Francisco next Monday", "San Francisco"],
      ["Los Angeles in March", "Los Angeles"],
      ["a week in Singapore", "Singapore"],
      ["Hong Kong on Tuesday", "Hong Kong"],
    ] as const) {
      expect(dest(sentence)).toBe(city);
    }
  });
});
