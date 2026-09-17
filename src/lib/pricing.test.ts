import { describe, expect, it } from "vitest";

import {
  FALLBACK_LEAD_TIME_TIERS,
  daysUntilDeparture,
  fromMinor,
  grossMinor,
  leadTimeDiscountBps,
  loadLeadTimeTiers,
  loadPricing,
  toMinor,
  withLeadTimeDiscount,
} from "@/lib/pricing.server";

type Row = {
  line_type: string;
  markup_bps: number;
  discount_bps: number;
  change_fee_minor: number;
};

/** Minimal stand-in for the Supabase query builder used by loadPricing. */
function stubSupabase(rows: Row[] | null) {
  return {
    from() {
      return {
        select() {
          const result = { data: rows, error: null };
          const eq = () => Object.assign(Promise.resolve(result), { like: async () => result });
          return { eq };
        },
      };
    },
  } as never;
}

const rules: Row[] = [
  { line_type: "flight", markup_bps: 600, discount_bps: 0, change_fee_minor: 2000 },
  { line_type: "stay", markup_bps: 1400, discount_bps: 0, change_fee_minor: 2000 },
  { line_type: "car", markup_bps: 1200, discount_bps: 0, change_fee_minor: 2000 },
  { line_type: "extras", markup_bps: 4000, discount_bps: 0, change_fee_minor: 2000 },
];

describe("minor units", () => {
  it("converts both ways without drift", () => {
    expect(toMinor(120.45)).toBe(12045);
    expect(fromMinor(12045)).toBe(120.45);
    expect(toMinor(0.005)).toBe(1);
  });
});

describe("gross price per line", () => {
  it("applies the free-plan base markups exactly", () => {
    expect(grossMinor(100, { markupBps: 600, discountBps: 0, changeFeeMinor: 2000 })).toBe(10600);
    expect(grossMinor(100, { markupBps: 1400, discountBps: 0, changeFeeMinor: 2000 })).toBe(11400);
    expect(grossMinor(100, { markupBps: 1200, discountBps: 0, changeFeeMinor: 2000 })).toBe(11200);
    expect(grossMinor(100, { markupBps: 4000, discountBps: 0, changeFeeMinor: 2000 })).toBe(14000);
  });

  it("takes the plan discount off the base markup", () => {
    // select = 300 bps off, signature = 600 bps off.
    expect(grossMinor(100, { markupBps: 600, discountBps: 300, changeFeeMinor: 2000 })).toBe(10300);
    expect(grossMinor(100, { markupBps: 1400, discountBps: 600, changeFeeMinor: 2000 })).toBe(
      10800,
    );
  });

  it("rounds at the minor-unit boundary", () => {
    expect(grossMinor(19.99, { markupBps: 600, discountBps: 0, changeFeeMinor: 0 })).toBe(2119);
    expect(grossMinor(0.01, { markupBps: 4000, discountBps: 0, changeFeeMinor: 0 })).toBe(1);
  });

  it("never marks up a commission-only reservation", () => {
    expect(grossMinor(48.5, { markupBps: 0, discountBps: 0, changeFeeMinor: 0 })).toBe(4850);
  });
});

describe("loadPricing", () => {
  it("reads the rules table", async () => {
    const table = await loadPricing(stubSupabase(rules), "free");
    expect(table.flight).toEqual({ markupBps: 600, discountBps: 0, changeFeeMinor: 2000 });
    expect(table.stay.markupBps).toBe(1400);
    expect(table.car.markupBps).toBe(1200);
    expect(table.extras.markupBps).toBe(4000);
  });

  it("falls back to the documented defaults when a plan has no rows", async () => {
    const table = await loadPricing(stubSupabase([]), "free");
    expect(table.flight.markupBps).toBe(600);
    expect(table.stay.markupBps).toBe(1200);
    expect(table.extras.markupBps).toBe(4000);
    expect(table.restaurant.markupBps).toBe(0);
    expect(table.flight.changeFeeMinor).toBe(2000);
    expect(table.ride.changeFeeMinor).toBe(0);
  });

  it("keeps the fallback for a line type the table does not mention", async () => {
    const table = await loadPricing(
      stubSupabase([
        { line_type: "flight", markup_bps: 900, discount_bps: 0, change_fee_minor: 500 },
      ]),
      "signature",
    );
    expect(table.flight).toEqual({ markupBps: 900, discountBps: 0, changeFeeMinor: 500 });
    expect(table.ride.markupBps).toBe(1000);
  });
});

describe("early-booking lead time", () => {
  it("counts whole days to departure", () => {
    const now = new Date("2026-09-12T15:00:00Z");
    expect(daysUntilDeparture("2026-12-15", now)).toBe(94);
    expect(daysUntilDeparture("2026-11-11", now)).toBe(60);
    expect(daysUntilDeparture("2026-09-12", now)).toBe(0);
    expect(daysUntilDeparture("2026-09-01", now)).toBe(0);
  });

  it("takes the best qualifying tier only", () => {
    const tiers = FALLBACK_LEAD_TIME_TIERS;
    expect(leadTimeDiscountBps(tiers, 94)).toBe(200);
    expect(leadTimeDiscountBps(tiers, 90)).toBe(200);
    expect(leadTimeDiscountBps(tiers, 89)).toBe(100);
    expect(leadTimeDiscountBps(tiers, 60)).toBe(100);
    expect(leadTimeDiscountBps(tiers, 59)).toBe(0);
  });

  it("reads the tiers from the rules table, best first", async () => {
    const tiers = await loadLeadTimeTiers(
      stubSupabase([
        { line_type: "lead_time_60", markup_bps: 0, discount_bps: 100, change_fee_minor: 0 },
        { line_type: "lead_time_90", markup_bps: 0, discount_bps: 200, change_fee_minor: 0 },
      ]),
      "free",
    );
    expect(tiers).toEqual([
      { minDays: 90, discountBps: 200 },
      { minDays: 60, discountBps: 100 },
    ]);
  });

  it("lowers our markup by the tier, and never below zero", async () => {
    const table = await loadPricing(stubSupabase(rules), "free");
    const discounted = withLeadTimeDiscount(table, 200);
    // 6% flight markup becomes 4%.
    expect(grossMinor(100, discounted.flight)).toBe(10400);
    expect(grossMinor(100, discounted.stay)).toBe(11200);
    // A commission-only line has no markup to give away.
    expect(grossMinor(100, discounted.restaurant)).toBe(10000);
  });

  it("changes nothing when the trip is booked late", async () => {
    const table = await loadPricing(stubSupabase(rules), "free");
    expect(withLeadTimeDiscount(table, 0)).toEqual(table);
  });
});
