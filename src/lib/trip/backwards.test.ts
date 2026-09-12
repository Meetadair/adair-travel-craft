import { describe, expect, it } from "vitest";

import { DEFAULT_PLANNING_RULES, groundMinutes, isSchengen, planBackwards } from "./backwards";
import type { FlightResult } from "./types";

const flight = (arriveAt: string, amountEur: number, carrier = "Test Air"): FlightResult => ({
  carrier,
  flightNumbers: ["100"],
  departAt: "2026-03-10T06:00:00Z",
  arriveAt,
  returnDepartAt: null,
  cabin: "economy",
  stops: 0,
  amount: amountEur,
  currency: "EUR",
  amountEur,
  approx: false,
  offerId: `off-${arriveAt}-${amountEur}`,
  expiresAt: null,
});

const base = {
  mustArriveBy: "2026-03-10T15:00:00Z",
  meetingLocation: "Duomo",
  destinationIata: "LIN",
  transferDistanceKm: 10,
  rules: DEFAULT_PLANNING_RULES,
  business: false,
};

describe("ground time", () => {
  it("uses a longer clearance outside Schengen", () => {
    expect(isSchengen("LIN")).toBe(true);
    expect(isSchengen("LHR")).toBe(false);
    const inside = groundMinutes({ ...base, candidates: [] });
    const outside = groundMinutes({ ...base, destinationIata: "LHR", candidates: [] });
    expect(inside.clearMin).toBe(45);
    expect(outside.clearMin).toBe(75);
    expect(outside.total).toBeGreaterThan(inside.total);
  });

  it("adds the extra margin for a business trip", () => {
    const leisure = groundMinutes({ ...base, candidates: [] });
    const business = groundMinutes({ ...base, business: true, candidates: [] });
    expect(business.safetyMin - leisure.safetyMin).toBe(
      DEFAULT_PLANNING_RULES.businessExtraMarginMin,
    );
  });
});

describe("planning backwards from a fixed arrival", () => {
  it("picks the latest flight that still clears the ground time", () => {
    const candidates = [
      flight("2026-03-10T09:00:00Z", 240),
      flight("2026-03-10T12:00:00Z", 180),
      flight("2026-03-10T14:30:00Z", 120),
    ];
    const { chosen, plan } = planBackwards({ ...base, candidates });
    const ground = groundMinutes({ ...base, candidates });
    expect(chosen?.arriveAt).toBe("2026-03-10T12:00:00Z");
    expect(plan.feasible).toBe(true);
    expect(plan.slackMin).toBeGreaterThanOrEqual(0);
    expect(Date.parse(plan.arriveAt)).toBe(
      Date.parse(plan.landAt) + ground.total * 60_000,
    );
    expect(plan.reasoning).toContain("safety margin");
    expect(plan.shortfall).toBeNull();
  });

  it("returns the honest shortfall when nothing lands in time", () => {
    const { plan } = planBackwards({
      ...base,
      candidates: [flight("2026-03-10T16:00:00Z", 120)],
    });
    expect(plan.feasible).toBe(false);
    expect(plan.slackMin).toBeLessThan(0);
    expect(plan.shortfall).toContain("No flight lands in time");
    expect(plan.suggestNightBefore).toBe(true);
    expect(plan.saferOption).toBeNull();
  });

  it("offers a calmer flight only when the pick is tight", () => {
    const tight = planBackwards({
      ...base,
      candidates: [flight("2026-03-10T13:00:00Z", 200), flight("2026-03-10T09:00:00Z", 150)],
    });
    expect(tight.plan.tight).toBe(true);
    expect(tight.plan.saferOption?.landAt).toBe("2026-03-10T09:00:00Z");

    const calm = planBackwards({
      ...base,
      candidates: [flight("2026-03-10T09:00:00Z", 150), flight("2026-03-10T08:00:00Z", 100)],
    });
    expect(calm.plan.tight).toBe(false);
    expect(calm.plan.saferOption).toBeNull();
  });

  it("sets the transfer pickup after airport clearance", () => {
    const { plan } = planBackwards({ ...base, candidates: [flight("2026-03-10T12:00:00Z", 180)] });
    expect(Date.parse(plan.transferPickupAt)).toBe(
      Date.parse("2026-03-10T12:00:00Z") + plan.clearMin * 60_000,
    );
  });

  it("a non-Schengen arrival can fail where the same time inside Schengen works", () => {
    const candidates = [flight("2026-03-10T13:00:00Z", 180)];
    expect(planBackwards({ ...base, candidates }).plan.feasible).toBe(true);
    expect(
      planBackwards({ ...base, destinationIata: "LHR", candidates }).plan.feasible,
    ).toBe(false);
  });
});
