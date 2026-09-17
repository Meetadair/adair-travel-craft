/**
 * Accrual and reversal of creator commission, against a stubbed database.
 *
 * What must hold: nothing accrues without an attribution or a recommended
 * place; commission is a share of OUR margin only; a curated place earns its
 * own creator; and a cancelled trip reverses whatever was accrued.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { accrueCreatorEarnings, reverseCreatorEarnings } from "@/lib/creators.server";

type Fixture = {
  attribution?: { creator_id: string; earning_until: string } | null;
  creatorStatus?: string;
  places?: Array<{ id: string; submitted_by_creator_id: string | null; review_status: string }>;
  rules?: Array<Record<string, unknown>>;
  plan?: string;
  pricing?: Array<{ plan: string; line_type: string; markup_bps: number }>;
};

function stubDb(fixture: Fixture) {
  const inserted: Array<Record<string, unknown>> = [];
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];

  const make = (table: string) => {
    let lineType = "";
    const result = () => {
      if (table === "creator_attributions") return { data: fixture.attribution ?? null };
      if (table === "creators")
        return { data: { id: "c1", status: fixture.creatorStatus ?? "approved" } };
      if (table === "getaway_places") return { data: fixture.places ?? [] };
      if (table === "creator_commission_rules") return { data: fixture.rules ?? [] };
      if (table === "profiles") return { data: { plan: fixture.plan ?? "free" } };
      if (table === "pricing_rules")
        return { data: (fixture.pricing ?? []).filter((r) => r.line_type === lineType) };
      return { data: [] };
    };
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        if (column === "line_type") lineType = String(value);
        return builder;
      },
      in: () => builder,
      lte: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => result(),
      insert: async (rows: Array<Record<string, unknown>>) => {
        inserted.push(...rows);
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        return builder;
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  };

  return { db: { from: (table: string) => make(table) } as any, inserted, updates };
}

const YEAR_AHEAD = new Date(Date.now() + 300 * 86_400_000).toISOString();

const STAY_RULE = {
  kind: "line",
  line_type: "stay",
  plan: null,
  share_bps: 3000,
  flat_minor: 0,
  earning_window_months: 12,
  active: true,
};

describe("accrueCreatorEarnings", () => {
  it("writes nothing without an attribution or a recommended place", async () => {
    const { db, inserted } = stubDb({ attribution: null, rules: [STAY_RULE] });
    const out = await accrueCreatorEarnings(db, "u1", "t1", [
      { tripItemId: "i1", kind: "stay", grossMinor: 50_000, netMinor: 40_000, status: "confirmed" },
    ]);
    expect(out.written).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("pays a share of the margin to the attributed creator", async () => {
    const { db, inserted } = stubDb({
      attribution: { creator_id: "c1", earning_until: YEAR_AHEAD },
      rules: [STAY_RULE],
    });
    const out = await accrueCreatorEarnings(db, "u1", "t1", [
      { tripItemId: "i1", kind: "stay", grossMinor: 50_000, netMinor: 40_000, status: "confirmed" },
    ]);
    expect(out.written).toBe(1);
    expect(inserted[0]).toMatchObject({
      creator_id: "c1",
      basis: "attribution",
      margin_minor: 10_000,
      amount_minor: 3_000,
      status: "pending",
      currency: "EUR",
    });
    expect(typeof inserted[0]!["confirmable_at"]).toBe("string");
  });

  it("ignores an expired attribution", async () => {
    const { db, inserted } = stubDb({
      attribution: {
        creator_id: "c1",
        earning_until: new Date(Date.now() - 86_400_000).toISOString(),
      },
      rules: [STAY_RULE],
    });
    expect(
      (
        await accrueCreatorEarnings(db, "u1", "t1", [
          {
            tripItemId: "i1",
            kind: "stay",
            grossMinor: 50_000,
            netMinor: 40_000,
            status: "confirmed",
          },
        ])
      ).written,
    ).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("ignores an attribution whose creator is no longer approved", async () => {
    const { db } = stubDb({
      attribution: { creator_id: "c1", earning_until: YEAR_AHEAD },
      creatorStatus: "paused",
      rules: [STAY_RULE],
    });
    expect(
      (
        await accrueCreatorEarnings(db, "u1", "t1", [
          {
            tripItemId: "i1",
            kind: "stay",
            grossMinor: 50_000,
            netMinor: 40_000,
            status: "confirmed",
          },
        ])
      ).written,
    ).toBe(0);
  });

  it("earns for the curator of a recommended place without any link", async () => {
    const { db, inserted } = stubDb({
      attribution: null,
      places: [{ id: "p1", submitted_by_creator_id: "c9", review_status: "approved" }],
      rules: [STAY_RULE],
    });
    const out = await accrueCreatorEarnings(db, "u1", "t1", [
      {
        tripItemId: "i1",
        kind: "stay",
        grossMinor: 30_000,
        netMinor: 20_000,
        status: "confirmed",
        getawayPlaceId: "p1",
      },
    ]);
    expect(out.written).toBe(1);
    expect(inserted[0]).toMatchObject({
      creator_id: "c9",
      basis: "recommendation",
      amount_minor: 3_000,
    });
  });

  it("skips a place submission that editorial has not approved", async () => {
    const { db } = stubDb({
      attribution: null,
      places: [{ id: "p1", submitted_by_creator_id: "c9", review_status: "pending" }],
      rules: [STAY_RULE],
    });
    expect(
      (
        await accrueCreatorEarnings(db, "u1", "t1", [
          {
            tripItemId: "i1",
            kind: "stay",
            grossMinor: 30_000,
            netMinor: 20_000,
            status: "confirmed",
            getawayPlaceId: "p1",
          },
        ])
      ).written,
    ).toBe(0);
  });

  it("skips failed and cancelled lines", async () => {
    const { db, inserted } = stubDb({
      attribution: { creator_id: "c1", earning_until: YEAR_AHEAD },
      rules: [STAY_RULE],
    });
    await accrueCreatorEarnings(db, "u1", "t1", [
      { tripItemId: "i1", kind: "stay", grossMinor: 50_000, netMinor: 40_000, status: "failed" },
      { tripItemId: "i2", kind: "stay", grossMinor: 50_000, netMinor: 40_000, status: "cancelled" },
    ]);
    expect(inserted).toHaveLength(0);
  });

  it("derives the margin from the markup when no net price was recorded", async () => {
    const { db, inserted } = stubDb({
      attribution: { creator_id: "c1", earning_until: YEAR_AHEAD },
      rules: [STAY_RULE],
      pricing: [{ plan: "free", line_type: "stay", markup_bps: 1400 }],
    });
    await accrueCreatorEarnings(db, "u1", "t1", [
      { tripItemId: "i1", kind: "stay", grossMinor: 114_000, netMinor: null, status: "confirmed" },
    ]);
    // 114000 * 1400 / 11400 = 14000 margin, 30% of that.
    expect(inserted[0]).toMatchObject({ margin_minor: 14_000, amount_minor: 4_200 });
  });

  it("treats insurance and restaurants as extras", async () => {
    const { db, inserted } = stubDb({
      attribution: { creator_id: "c1", earning_until: YEAR_AHEAD },
      rules: [{ ...STAY_RULE, line_type: "extras", share_bps: 2000 }],
    });
    await accrueCreatorEarnings(db, "u1", "t1", [
      {
        tripItemId: "i1",
        kind: "insurance",
        grossMinor: 10_000,
        netMinor: 5_000,
        status: "confirmed",
      },
    ]);
    expect(inserted[0]).toMatchObject({ line_type: "extras", amount_minor: 1_000 });
  });
});

describe("reverseCreatorEarnings", () => {
  it("reverses the accrued lines of a cancelled trip", async () => {
    const { db, updates } = stubDb({});
    await reverseCreatorEarnings(db, "t1");
    expect(updates).toEqual([
      {
        table: "creator_earnings",
        patch: { status: "reversed", note: "Booking cancelled or refunded" },
      },
    ]);
  });
});
