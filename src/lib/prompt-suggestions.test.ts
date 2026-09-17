import { describe, expect, it } from "vitest";
import {
  buildSuggestions,
  dailySeed,
  rotateSuggestions,
  type Suggestion,
} from "./prompt-suggestions";

describe("prompt suggestions", () => {
  it("returns nothing without a home airport city", () => {
    expect(buildSuggestions({ homeCity: null, companyName: "KRAM" })).toEqual([]);
  });

  it("always departs from the home city", () => {
    const out = buildSuggestions({
      homeCity: "Warsaw",
      pastTrip: { city: "Milan", startDate: "2026-03-11" },
      companyName: "KRAM Investment S.A.",
      getaway: { city: "Tuscany", interest: "cycling" },
      businessCity: "Vienna",
    });
    expect(out.length).toBe(4);
    for (const s of out) expect(s.text).toContain("Warsaw");
  });

  it("keeps the documented priority order", () => {
    const out = buildSuggestions({
      homeCity: "Warsaw",
      pastTrip: { city: "Milan", startDate: "2026-03-11" },
      companyName: "KRAM",
      getaway: { city: "Tuscany", interest: "cycling" },
      businessCity: "Vienna",
    });
    expect(out.map((s) => s.id)).toEqual(["repeat", "company", "getaway", "arrive-by"]);
  });

  it("phrases a repeat trip with the month it happened", () => {
    const [first] = buildSuggestions({
      homeCity: "Warsaw",
      pastTrip: { city: "Milan", startDate: "2026-03-11" },
    });
    expect(first?.text).toBe("Same as Milan in March, but a week later — from Warsaw.");
  });

  it("uses the real company name in the business example", () => {
    const out = buildSuggestions({ homeCity: "Warsaw", companyName: "KRAM Investment S.A." });
    expect(out[0]?.text).toContain("invoice to KRAM Investment S.A.");
  });

  it("skips candidates the profile does not support", () => {
    const out = buildSuggestions({ homeCity: "Warsaw", businessCity: "Vienna" });
    expect(out.map((s) => s.id)).toEqual(["arrive-by"]);
  });

  it("rotates but stays stable within a day", () => {
    const candidates: Suggestion[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, text: id }));
    const monday = new Date("2026-09-14T08:00:00Z");
    const seed = dailySeed("user-1", monday);
    expect(rotateSuggestions(candidates, seed)).toEqual(
      rotateSuggestions(candidates, dailySeed("user-1", new Date("2026-09-14T21:00:00Z"))),
    );
    expect(rotateSuggestions(candidates, seed)).toHaveLength(3);
    const other = rotateSuggestions(
      candidates,
      dailySeed("user-1", new Date("2026-09-19T08:00:00Z")),
    );
    expect(other.map((s) => s.id)).not.toEqual(
      rotateSuggestions(candidates, seed).map((s) => s.id),
    );
  });

  it("returns everything when there are three or fewer candidates", () => {
    const candidates: Suggestion[] = [
      { id: "a", text: "a" },
      { id: "b", text: "b" },
    ];
    expect(rotateSuggestions(candidates, "seed")).toEqual(candidates);
  });
});
