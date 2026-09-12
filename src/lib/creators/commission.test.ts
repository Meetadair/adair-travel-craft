import { describe, expect, it } from "vitest";
import {
  byMonth,
  commissionMinor,
  marginMinor,
  normaliseCreatorCode,
  normaliseHandle,
  payableMinor,
  reachedPayoutFloor,
  withinEarningWindow,
} from "./commission";

describe("margin", () => {
  it("uses the recorded net price when there is one", () => {
    expect(marginMinor(12000, 10000, 2000)).toBe(2000);
  });

  it("derives the margin from the markup when no net price was stored", () => {
    // €120 gross at 20% markup means €100 net, so €20 is ours.
    expect(marginMinor(12000, 0, 2000)).toBe(2000);
  });

  it("earns nothing without a markup and without a net price", () => {
    expect(marginMinor(12000, null, 0)).toBe(0);
  });
});

describe("commission", () => {
  it("takes a share of our margin, never of the total", () => {
    expect(commissionMinor(2000, 3000)).toBe(600);
  });

  it("never pays on a zero or negative margin", () => {
    expect(commissionMinor(0, 3000)).toBe(0);
    expect(commissionMinor(-500, 3000)).toBe(0);
  });
});

describe("earning window", () => {
  it("keeps earning for the whole window, then stops", () => {
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(withinEarningWindow(soon)).toBe(true);
    expect(withinEarningWindow(past)).toBe(false);
  });
});

describe("ledger", () => {
  it("only pays out confirmed lines", () => {
    expect(
      payableMinor([
        { amountMinor: 1000, status: "confirmed" },
        { amountMinor: 5000, status: "pending" },
        { amountMinor: 900, status: "reversed" },
        { amountMinor: 400, status: "paid" },
      ]),
    ).toBe(1000);
  });

  it("holds a balance below the €50 floor", () => {
    expect(reachedPayoutFloor(4999)).toBe(false);
    expect(reachedPayoutFloor(5000)).toBe(true);
  });

  it("groups by month, newest first", () => {
    const months = byMonth([
      { createdAt: "2026-08-04T00:00:00Z", amountMinor: 500, status: "confirmed" },
      { createdAt: "2026-09-01T00:00:00Z", amountMinor: 700, status: "pending" },
    ]);
    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-08"]);
    expect(months[0]!.pendingMinor).toBe(700);
  });
});

describe("handles and codes", () => {
  it("makes a URL-safe handle or nothing", () => {
    expect(normaliseHandle("  Kitti Travels! ")).toBe("kitti-travels");
    expect(normaliseHandle("ab")).toBe("");
  });

  it("normalises a pasted code", () => {
    expect(normaliseCreatorCode("cr 4b7k2m")).toBe("CR-4B7K2M");
    expect(normaliseCreatorCode("")).toBe("");
  });
});
