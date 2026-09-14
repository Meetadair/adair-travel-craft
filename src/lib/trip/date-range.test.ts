import { describe, expect, it } from "vitest";

import { isCompleteRange, rangeSentence } from "./answers";

describe("isCompleteRange", () => {
  it("rejects nothing at all", () => {
    expect(isCompleteRange(null)).toBe(false);
    expect(isCompleteRange(undefined)).toBe(false);
  });

  it("rejects a departure with no return", () => {
    expect(isCompleteRange({ departDate: "2026-10-01" })).toBe(false);
  });

  it("rejects a return before the departure", () => {
    expect(isCompleteRange({ departDate: "2026-10-04", returnDate: "2026-10-01" })).toBe(false);
  });

  it("accepts a same-day return — a day trip is still two ends", () => {
    expect(isCompleteRange({ departDate: "2026-10-01", returnDate: "2026-10-01" })).toBe(true);
  });

  it("accepts a real range", () => {
    expect(isCompleteRange({ departDate: "2026-10-01", returnDate: "2026-10-04" })).toBe(true);
  });
});

describe("rangeSentence", () => {
  it("writes both ends into the sentence", () => {
    expect(rangeSentence({ departDate: "2026-10-01", returnDate: "2026-10-04" })).toBe(
      "from 2026-10-01 to 2026-10-04",
    );
  });
});
