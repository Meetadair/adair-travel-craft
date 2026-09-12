import { describe, expect, it } from "vitest";

import { fromMinor, grossMinor, loadPricing, toMinor } from "@/lib/pricing.server";

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
          return {
            eq: async () => ({ data: rows, error: null }),
          };
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
    expect(grossMinor(100, { markupBps: 1400, discountBps: 600, changeFeeMinor: 2000 })).toBe(10800);
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
      stubSupabase([{ line_type: "flight", markup_bps: 900, discount_bps: 0, change_fee_minor: 500 }]),
      "signature",
    );
    expect(table.flight).toEqual({ markupBps: 900, discountBps: 0, changeFeeMinor: 500 });
    expect(table.ride.markupBps).toBe(1000);
  });
});
