import { describe, expect, it } from "vitest";

import {
  applyPriceTieBreak,
  dealVerdict,
  inSeason,
  interestScore,
  reachFrom,
  weekStartIso,
  WEEKEND_MAX_HOURS,
  type ScoredCandidate,
} from "./match";
import { staysPassingDealbreakers, carsPassingDealbreakers } from "@/lib/trip/rank";
import { DEFAULT_PREFS } from "@/lib/prefs/questions";

const WARSAW = { lat: 52.23, lon: 21.01 };

describe("reach filtering", () => {
  it("keeps a short flight as a weekend option", () => {
    const vienna = reachFrom(WARSAW, "WAW", { lat: 48.21, lon: 16.37 }, []);
    expect(vienna?.ok).toBe(true);
    expect(vienna?.weekend).toBe(true);
    expect(vienna!.hours).toBeLessThanOrEqual(WEEKEND_MAX_HOURS);
  });

  it("excludes anything beyond the weekend threshold from weekend proposals", () => {
    const tenerife = reachFrom(WARSAW, "WAW", { lat: 28.04, lon: -16.57 }, []);
    expect(tenerife?.weekend).toBe(false);
    expect(tenerife!.hours).toBeGreaterThan(WEEKEND_MAX_HOURS);
  });

  it("prefers driving only where the destination is genuinely drivable", () => {
    const lublin = { lat: 51.25, lon: 22.57 };
    expect(reachFrom(WARSAW, "WAW", lublin, ["WAW"])?.mode).toBe("drive");
    expect(reachFrom(WARSAW, "WAW", lublin, [])?.mode).toBe("fly");
  });

  it("reports an unknown origin rather than guessing", () => {
    expect(reachFrom(null, "XXX", WARSAW, [])).toBeNull();
  });
});

describe("season filtering", () => {
  it("is a hard rule, both ways", () => {
    expect(inSeason([12, 1, 2, 3], 1)).toBe(true);
    expect(inSeason([12, 1, 2, 3], 7)).toBe(false); // never ski in July
    expect(inSeason([6, 7, 8], 2)).toBe(false); // never a beach weekend in February
    expect(inSeason(null, 7)).toBe(false);
  });
});

describe("dealbreakers are hard filters, not score deductions", () => {
  const prefs = { ...DEFAULT_PREFS, dealbreakers: ["dbStars4", "dbNoHostel", "dbAutomatic"] };

  it("removes a candidate outright", () => {
    const stays = [
      { name: "Grand Hotel", rating: 4.6 },
      { name: "Cheap Hostel", rating: 4.8 },
      { name: "Three Star Inn", rating: 3.2 },
      { name: "Unrated Place", rating: null as number | null },
    ];
    const kept = staysPassingDealbreakers(stays, (s) => s, prefs);
    expect(kept.map((s) => s.name)).toEqual(["Grand Hotel"]);

    const cars = [{ transmission: "Automatic" }, { transmission: "Manual" }];
    expect(carsPassingDealbreakers(cars, (c) => c, prefs)).toEqual([{ transmission: "Automatic" }]);
  });

  it("leaves everything in place when no rules are set", () => {
    const stays = [{ name: "Cheap Hostel", rating: 2 }];
    expect(staysPassingDealbreakers(stays, (s) => s, DEFAULT_PREFS)).toEqual(stays);
  });
});

describe("interest match ranks before price", () => {
  const theme = {
    id: "t1",
    slug: "cycling",
    name: "Cycling",
    interestTags: ["cycling", "outdoors"],
  };

  it("scores a matching profile above an unrelated one", () => {
    const match = interestScore(
      theme,
      { interests: ["sports"], cuisines: [], budgetBand: null, extraAnswers: {} },
      "Girona",
      false,
    );
    const noMatch = interestScore(
      theme,
      { interests: ["museums"], cuisines: [], budgetBand: null, extraAnswers: {} },
      "Girona",
      false,
    );
    expect(match.score).toBeGreaterThan(noMatch.score);
    expect(match.reasons.join(" ")).toContain("Girona is in season now");
  });

  it("a cheaper destination never outranks a better match", () => {
    const candidates: ScoredCandidate[] = [
      { destinationId: "cheap", themeId: "t1", score: 20, reasons: [] },
      { destinationId: "better", themeId: "t1", score: 40, reasons: [] },
    ];
    const ordered = applyPriceTieBreak(candidates, { cheap: 1, better: 0 });
    expect(ordered[0]!.destinationId).toBe("better");
  });

  it("price only breaks a tie between equal matches", () => {
    const candidates: ScoredCandidate[] = [
      { destinationId: "a", themeId: "t1", score: 30, reasons: [] },
      { destinationId: "b", themeId: "t1", score: 30, reasons: [] },
    ];
    expect(applyPriceTieBreak(candidates, { a: 0, b: 1 })[0]!.destinationId).toBe("b");
  });
});

describe("our own price baseline", () => {
  it("says nothing without enough history", () => {
    expect(dealVerdict(12000, [11000, 12000])).toBeNull();
    expect(dealVerdict(null, [1, 2, 3, 4])).toBeNull();
  });

  it("calls a genuine deal a deal", () => {
    const history = [20000, 21000, 19000, 22000, 20500];
    expect(dealVerdict(12000, history)?.better).toBe(true);
    expect(dealVerdict(20000, history)?.better).toBe(false);
    expect(dealVerdict(30000, history)?.label).toContain("Above");
  });
});

describe("week start", () => {
  it("is the Monday of the current week", () => {
    expect(weekStartIso(new Date("2026-03-12T10:00:00Z"))).toBe("2026-03-09");
    expect(weekStartIso(new Date("2026-03-09T00:00:00Z"))).toBe("2026-03-09");
  });
});
