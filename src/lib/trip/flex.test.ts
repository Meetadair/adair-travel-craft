import { describe, expect, it } from "vitest";
import { bestSaving, flexWindows, shiftIso, type FlexPrice } from "./flex";

describe("flexible dates", () => {
  it("moves the whole trip, keeping its length", () => {
    const w = flexWindows("2026-10-10", "2026-10-17", 3, "2026-09-14");
    for (const win of w) {
      expect(shiftIso(win.departDate, 7)).toBe(win.returnDate);
    }
  });

  it("offers the nearest days first, because one day matters more than three", () => {
    const w = flexWindows("2026-10-10", "2026-10-17", 3, "2026-09-14");
    expect(w.map((x) => x.offset)).toEqual([-1, 1, -2, 2, -3, 3]);
  });

  it("never proposes a departure in the past", () => {
    // Departing today is allowed — it is a real, bookable option. Yesterday is
    // not, so the two backward steps that would land there are dropped.
    const w = flexWindows("2026-09-15", undefined, 3, "2026-09-14");
    expect(w.every((x) => x.departDate >= "2026-09-14")).toBe(true);
    expect(w.map((x) => x.offset)).toEqual([-1, 1, 2, 3]);
  });

  it("handles a one-way, which has no return to move", () => {
    const w = flexWindows("2026-10-10", undefined, 2, "2026-09-14");
    expect(w.every((x) => x.returnDate === undefined)).toBe(true);
  });

  it("is off when flexibility is off", () => {
    expect(flexWindows("2026-10-10", "2026-10-17", 0, "2026-09-14")).toEqual([]);
  });

  it("picks the biggest real saving", () => {
    const priced: FlexPrice[] = [
      { window: { departDate: "2026-10-09", returnDate: "2026-10-16", offset: -1 }, amount: 380, currency: "EUR" },
      { window: { departDate: "2026-10-12", returnDate: "2026-10-19", offset: 2 }, amount: 290, currency: "EUR" },
    ];
    expect(bestSaving(420, "EUR", priced)?.saveAmount).toBe(130);
    expect(bestSaving(420, "EUR", priced)?.departDate).toBe("2026-10-12");
  });

  it("stays quiet about a saving too small to be worth moving a trip for", () => {
    const priced: FlexPrice[] = [
      { window: { departDate: "2026-10-09", returnDate: "2026-10-16", offset: -1 }, amount: 416, currency: "EUR" },
    ];
    expect(bestSaving(420, "EUR", priced)).toBeNull();
  });

  it("never compares across currencies", () => {
    const priced: FlexPrice[] = [
      { window: { departDate: "2026-10-09", returnDate: "2026-10-16", offset: -1 }, amount: 100, currency: "PLN" },
    ];
    expect(bestSaving(420, "EUR", priced)).toBeNull();
  });
});
