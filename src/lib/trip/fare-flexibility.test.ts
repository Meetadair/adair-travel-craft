import { describe, expect, it } from "vitest";
import { changeFeeEur, flexibilityOf, isChangeable } from "./fare-flexibility";

const fare = (o: Partial<Parameters<typeof flexibilityOf>[0]> = {}) => ({
  changeable: null,
  refundable: null,
  changePenaltyEur: null,
  refundPenaltyEur: null,
  ...o,
});

describe("how flexible a fare is", () => {
  it("reads the real British Airways fare from a live search", () => {
    // WAW–LHR, €160.97: changeable for €60, not refundable.
    const f = flexibilityOf(fare({ changeable: true, changePenaltyEur: 60, refundable: false }));
    expect(f.label).toBe("Changeable · €60");
    expect(f.tone).toBe("penalty");
    expect(f.detail).toBe("non-refundable · changeable, €60 fee");
  });

  it("reads the real Lufthansa fare beside it", () => {
    // €204.48 and changeable for €200 — dearer and less flexible, which is
    // exactly the comparison nothing on screen was making.
    const f = flexibilityOf(fare({ changeable: true, changePenaltyEur: 200, refundable: false }));
    expect(f.label).toBe("Changeable · €200");
  });

  it("leads with the best news a traveller can act on", () => {
    expect(flexibilityOf(fare({ refundable: true, changeable: true })).label).toBe(
      "Fully refundable",
    );
    expect(flexibilityOf(fare({ refundable: false, changeable: true })).label).toBe("Free changes");
  });

  it("says fixed when the airline allows neither", () => {
    expect(flexibilityOf(fare({ changeable: false, refundable: false })).label).toBe("Fixed dates");
  });

  it("says nothing at all when the airline stated nothing", () => {
    // Guessing "non-refundable" from silence is a claim we cannot support, and
    // a traveller who acts on it loses money.
    const f = flexibilityOf(fare());
    expect(f.label).toBeNull();
    expect(f.detail).toBeNull();
    expect(f.tone).toBe("unknown");
  });

  it("never says changeable without saying what it costs", () => {
    const f = flexibilityOf(fare({ changeable: true, changePenaltyEur: 200 }));
    expect(f.label).toContain("€200");
  });

  it("knows whether a booking may be moved, and what that costs", () => {
    expect(isChangeable(fare({ changeable: true, changePenaltyEur: 60 }))).toBe(true);
    expect(changeFeeEur(fare({ changeable: true, changePenaltyEur: 60 }))).toBe(60);
    expect(isChangeable(fare({ changeable: false }))).toBe(false);
    expect(changeFeeEur(fare({ changeable: false, changePenaltyEur: 60 }))).toBe(0);
    // Silence is not permission.
    expect(isChangeable(fare())).toBe(false);
  });
});
