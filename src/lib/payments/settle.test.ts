import { describe, expect, it } from "vitest";
import { settlementFor } from "./settle";

const base = {
  confirmedTotalEur: 0,
  creditAppliedMinor: 0,
  paidAtSupplierEur: 0,
  settlementModel: "merchant-of-record" as const,
};

describe("settlementFor", () => {
  it("takes the whole total when we paid the airline ourselves", () => {
    expect(settlementFor({ ...base, confirmedTotalEur: 842.5 }).captureMinor).toBe(84250);
  });

  it("takes only what the supplier did not already charge this card", () => {
    // 842.50 trip, of which Duffel took 512.40 straight off the card.
    const plan = settlementFor({
      ...base,
      confirmedTotalEur: 842.5,
      paidAtSupplierEur: 512.4,
    });
    expect(plan.captureMinor).toBe(33010);
    expect(plan.note).toMatch(/supplier/);
  });

  it("deducts credit the traveller already spent", () => {
    expect(
      settlementFor({ ...base, confirmedTotalEur: 200, creditAppliedMinor: 5000 }).captureMinor,
    ).toBe(15000);
  });

  it("releases the hold when nothing is left to take", () => {
    const plan = settlementFor({
      ...base,
      confirmedTotalEur: 300,
      paidAtSupplierEur: 300,
    });
    expect(plan.captureMinor).toBe(0);
    expect(plan.note).toMatch(/full amount/);
  });

  it("never captures a negative amount when the supplier took more than the total", () => {
    expect(
      settlementFor({ ...base, confirmedTotalEur: 100, paidAtSupplierEur: 140 }).captureMinor,
    ).toBe(0);
  });

  it("captures nothing when the supplier is the merchant of record", () => {
    const plan = settlementFor({
      ...base,
      confirmedTotalEur: 842.5,
      settlementModel: "supplier-of-record",
    });
    expect(plan.captureMinor).toBe(0);
    expect(plan.note).toMatch(/directly/);
  });

  it("rounds to whole cents rather than carrying float error", () => {
    expect(
      settlementFor({ ...base, confirmedTotalEur: 10.1 + 20.2, paidAtSupplierEur: 0 })
        .captureMinor,
    ).toBe(3030);
  });
});
