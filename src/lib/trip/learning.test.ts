import { describe, expect, it } from "vitest";
import {
  applyPrecedence,
  brandOf,
  learnFrom,
  noticedSentences,
  type FeedbackRow,
  type StatedPrefs,
} from "@/lib/trip/learning";

const stated: StatedPrefs = {
  airlines: [],
  hotelChains: [],
  carBrands: [],
  carCompanies: [],
  dealbreakers: [],
};

const swap = (itemKind: string, rejectedTitle: string, reason: string | null = null): FeedbackRow => ({
  itemKind,
  rejectedTitle,
  reason,
});

describe("learning from swaps", () => {
  it("recognises the brand behind a rejected option", () => {
    expect(brandOf("hotel", "Sheraton Grand Warsaw")).toBe("sheraton");
    expect(brandOf("flight", "LOT Polish Airlines LO 123")).toBe("lot");
    expect(brandOf("hotel", "Pension Zur Sonne")).toBeNull();
  });

  it("ranks a chain down only after two rejections", () => {
    const once = learnFrom([swap("hotel", "Ibis Budget Berlin")]);
    expect(once.avoid).toHaveLength(0);

    const twice = learnFrom([
      swap("hotel", "Ibis Berlin Mitte"),
      swap("hotel", "Ibis Warsaw Centrum"),
    ]);
    expect(twice.avoid).toEqual([{ kind: "hotel", brandId: "ibis", times: 2 }]);
  });

  it("tightens distance after repeated 'too far'", () => {
    const learned = learnFrom([
      swap("hotel", "A", "too far from the centre"),
      swap("hotel", "B", "za daleko od centrum"),
    ]);
    expect(learned.distanceWeight).toBeGreaterThan(1);
    expect(learned.priceWeight).toBe(1);
  });

  it("weighs price higher after repeated 'too expensive'", () => {
    const learned = learnFrom([
      swap("flight", "A", "too expensive"),
      swap("flight", "B", "za drogo"),
      swap("flight", "C", "too expensive"),
      swap("flight", "D", "too expensive"),
    ]);
    expect(learned.priceWeight).toBe(1.5);
  });

  it("says what it noticed in plain words", () => {
    const learned = learnFrom([
      swap("hotel", "Ibis Berlin", "too far"),
      swap("hotel", "Ibis Warsaw", "too far"),
    ]);
    const lines = noticedSentences(applyPrecedence(learned, stated), (id) => id);
    expect(lines[0]).toContain("staying at ibis");
    expect(lines.join(" ")).toContain("closer to the centre");
  });
});

describe("stated wins over learned", () => {
  it("never ranks down a chain the traveller chose", () => {
    const learned = learnFrom([
      swap("hotel", "Ibis Berlin"),
      swap("hotel", "Ibis Warsaw"),
    ]);
    expect(learned.avoid).toHaveLength(1);
    const applied = applyPrecedence(learned, { ...stated, hotelChains: ["ibis"] });
    expect(applied.avoid).toHaveLength(0);
  });

  it("never ranks down an airline the traveller chose", () => {
    const learned = learnFrom([swap("flight", "LOT LO 1"), swap("flight", "LOT LO 2")]);
    const applied = applyPrecedence(learned, { ...stated, airlines: ["lot"] });
    expect(applied.avoid).toHaveLength(0);
  });

  it("drops an adjustment the traveller reset", () => {
    const learned = learnFrom([swap("car", "Sixt compact"), swap("car", "Sixt estate")]);
    expect(applyPrecedence(learned, stated, ["sixt"]).avoid).toHaveLength(0);
  });

  it("resets the distance and price weights on request", () => {
    const learned = learnFrom([
      swap("hotel", "A", "too far"),
      swap("hotel", "B", "too far"),
      swap("hotel", "C", "too expensive"),
      swap("hotel", "D", "too expensive"),
    ]);
    const applied = applyPrecedence(learned, stated, ["distance", "price"]);
    expect(applied.distanceWeight).toBe(1);
    expect(applied.priceWeight).toBe(1);
  });
});
