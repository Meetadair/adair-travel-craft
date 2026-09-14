import { describe, expect, it } from "vitest";

import { MATCH_DOTS, matchDots, type LineMatch } from "./match";

const match = (met: number, total: number): LineMatch => ({
  met,
  total,
  criteria: Array.from({ length: total }, (_, index) => ({
    ok: index < met,
    label: `criterion ${index + 1}`,
  })),
});

describe("matchDots", () => {
  it("uses a fixed scale of five", () => {
    expect(MATCH_DOTS).toBe(5);
  });

  it("fills every dot on a complete match", () => {
    expect(matchDots(match(3, 3))).toBe(5);
  });

  it("scales a partial match proportionally", () => {
    expect(matchDots(match(2, 4))).toBe(3);
    expect(matchDots(match(4, 5))).toBe(4);
  });

  it("never shows a partial match as perfect", () => {
    // 9 of 10 rounds to 5 dots, which would read as everything matched.
    expect(matchDots(match(9, 10))).toBe(4);
  });

  it("never shows a real match as none", () => {
    expect(matchDots(match(1, 12))).toBe(1);
  });

  it("shows no dots when nothing matched", () => {
    expect(matchDots(match(0, 4))).toBe(0);
  });

  it("returns nothing when there was nothing to check", () => {
    expect(matchDots(match(0, 0))).toBeNull();
    expect(matchDots(null)).toBeNull();
    expect(matchDots(undefined)).toBeNull();
  });
});
