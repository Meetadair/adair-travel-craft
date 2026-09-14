import { describe, expect, it } from "vitest";
import {
  authorisedOverspendMinor,
  decide,
  isValidRelease,
  mayRelease,
  remainingMinor,
  stateOf,
  usedFraction,
  type Budget,
} from "./budget";

const make = (over: Partial<Budget> = {}): Budget => ({
  id: "b1",
  name: "Operations",
  scope: "cost_centre",
  period: "quarter",
  limitMinor: 100_000,
  spentMinor: 0,
  committedMinor: 0,
  currency: "EUR",
  releaseAuthorityId: "maria",
  releaseAuthorityName: "M. Lewandowska",
  ...over,
});

describe("where a budget stands", () => {
  it("counts committed money as spent, because the trip is booked", () => {
    const b = make({ spentMinor: 30_000, committedMinor: 20_000 });
    expect(usedFraction(b)).toBe(0.5);
    expect(remainingMinor(b)).toBe(50_000);
  });

  it("stays quiet below four fifths", () => {
    expect(stateOf(make({ spentMinor: 79_000 }))).toBe("ok");
  });

  it("notes it at four fifths", () => {
    expect(stateOf(make({ spentMinor: 80_000 }))).toBe("notify");
  });

  it("needs approving exactly at the limit, and blocks past it", () => {
    expect(stateOf(make({ spentMinor: 100_000 }))).toBe("approve");
    expect(stateOf(make({ spentMinor: 100_001 }))).toBe("blocked");
  });

  it("never divides by a limit of zero", () => {
    expect(usedFraction(make({ limitMinor: 0, spentMinor: 500 }))).toBe(0);
  });
});

describe("deciding a booking", () => {
  it("lets an ordinary trip through without telling anyone", () => {
    const d = decide(10_000, [make({ spentMinor: 20_000 })]);
    expect(d.state).toBe("ok");
    expect(d.releaseAuthorityName).toBeNull();
  });

  it("blocks the trip that would go over, and names one person", () => {
    const d = decide(30_000, [make({ spentMinor: 90_000 })]);
    expect(d.state).toBe("blocked");
    expect(d.shortfallMinor).toBe(20_000);
    expect(d.releaseAuthorityName).toBe("M. Lewandowska");
  });

  it("takes the strictest of the budgets a trip touches", () => {
    // A personal budget with room left must not rescue a cost centre that is
    // out of money — that would be a hole straight through the control.
    const personal = make({ id: "p", scope: "person", limitMinor: 150_000, spentMinor: 0 });
    const centre = make({ id: "c", spentMinor: 99_000 });
    const d = decide(5_000, [personal, centre]);
    expect(d.state).toBe("blocked");
    expect(d.decidedBy?.id).toBe("c");
  });

  it("names the tightest budget when two are equally severe", () => {
    const a = make({ id: "a", limitMinor: 100_000, spentMinor: 50_000 });
    const b = make({ id: "b", limitMinor: 60_000, spentMinor: 30_000 });
    expect(decide(1_000, [a, b]).decidedBy?.id).toBe("b");
  });

  it("does not stop anyone when no budget has been set", () => {
    expect(decide(999_999, []).state).toBe("ok");
    expect(decide(999_999, [make({ limitMinor: 0 })]).state).toBe("ok");
  });

  it("reports what is left, not what is left after the blocked trip", () => {
    const d = decide(30_000, [make({ spentMinor: 90_000 })]);
    expect(d.remainingMinor).toBe(10_000);
  });
});

describe("who may release it", () => {
  it("is the named authority, and nobody else", () => {
    const b = make();
    expect(mayRelease(b, "maria", 0)).toBe(true);
    expect(mayRelease(b, "anyone-else", 0)).toBe(false);
    // Not even an administrator: administrators change who the authority is,
    // which is itself audited. They do not release bookings.
    expect(mayRelease(b, "admin", 999)).toBe(false);
  });

  it("lets a deputy act only after the authority has gone quiet", () => {
    const b = make({ deputyId: "piotr", deputyAfterHours: 12 });
    expect(mayRelease(b, "piotr", 4)).toBe(false);
    expect(mayRelease(b, "piotr", 12)).toBe(true);
  });

  it("gives a deputy with no waiting period no authority at all", () => {
    const b = make({ deputyId: "piotr" });
    expect(mayRelease(b, "piotr", 999)).toBe(false);
  });
});

describe("authorised overspend", () => {
  it("is reported on its own, never folded into ordinary spend", () => {
    const releases = [
      { budgetId: "c", releasedById: "maria", amountMinor: 20_000, reason: "Client demanded it", kind: "once" as const, at: "2026-09-01" },
      { budgetId: "c", releasedById: "maria", amountMinor: 5_000, reason: "Fare expired", kind: "once" as const, at: "2026-09-04" },
    ];
    expect(authorisedOverspendMinor(releases)).toBe(25_000);
  });

  it("refuses a release with no reason behind it", () => {
    expect(isValidRelease({ reason: "", amountMinor: 1_000 })).toBe(false);
    expect(isValidRelease({ reason: "  ", amountMinor: 1_000 })).toBe(false);
    expect(isValidRelease({ reason: "Board approved", amountMinor: 1_000 })).toBe(true);
  });
});
