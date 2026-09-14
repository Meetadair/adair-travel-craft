import { describe, expect, it } from "vitest";
import { isCompleteRange, rangeSentence } from "./answers";
import { isOneWay, parseTripSentence } from "./parse";

describe("a one-way chosen in the picker survives the round trip", () => {
  it("is complete with only an outbound day", () => {
    expect(isCompleteRange({ departDate: "2026-10-05" })).toBe(false);
    expect(isCompleteRange({ departDate: "2026-10-05", oneWay: true })).toBe(true);
  });

  it("folds into a sentence the parser reads back", () => {
    const sentence = rangeSentence({ departDate: "2026-10-05", oneWay: true });
    expect(sentence).toBe("on 2026-10-05, one way");
    expect(isOneWay(sentence)).toBe(true);
    // And end to end: picker -> sentence -> parser -> single Duffel slice.
    expect(parseTripSentence(`Milan ${sentence}`)?.oneWay).toBe(true);
  });

  it("leaves a return trip exactly as it was", () => {
    const r = { departDate: "2026-10-05", returnDate: "2026-10-09" };
    expect(rangeSentence(r)).toBe("from 2026-10-05 to 2026-10-09");
    expect(isOneWay(rangeSentence(r))).toBe(false);
    expect(isCompleteRange(r)).toBe(true);
  });
});
