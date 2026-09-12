import { describe, expect, it } from "vitest";
import {
  balanceOf,
  creditToApply,
  makeCode,
  normaliseCode,
  FRIEND_REWARD_MINOR,
  REFERRER_REWARD_MINOR,
} from "./referrals.server";

describe("referral codes", () => {
  it("makes a readable prefixed code", () => {
    const code = makeCode();
    expect(code).toMatch(/^AD-[A-Z2-9]{7}$/);
  });

  it("normalises what people paste", () => {
    expect(normaliseCode(" ad-abc1234 ")).toBe("AD-ABC1234");
    expect(normaliseCode("AD ABC1234")).toBe("AD-ABC1234");
    expect(normaliseCode("")).toBe("");
  });
});

describe("credit ledger", () => {
  it("adds grants and subtracts spends", () => {
    expect(
      balanceOf([
        { kind: "grant", amount_minor: 4000 },
        { kind: "grant", amount_minor: 2000 },
        { kind: "spend", amount_minor: 1500 },
      ]),
    ).toBe(4500);
  });

  it("never goes negative", () => {
    expect(balanceOf([{ kind: "spend", amount_minor: 5000 }])).toBe(0);
  });

  it("treats a spend as a spend even when stored negative", () => {
    expect(
      balanceOf([
        { kind: "grant", amount_minor: 4000 },
        { kind: "spend", amount_minor: -1000 },
      ]),
    ).toBe(3000);
  });

  it("never applies more credit than the trip costs", () => {
    expect(creditToApply(6000, 4500)).toBe(4500);
    expect(creditToApply(2000, 4500)).toBe(2000);
    expect(creditToApply(0, 4500)).toBe(0);
    expect(creditToApply(6000, 0)).toBe(0);
  });

  it("uses the promised reward amounts", () => {
    expect(REFERRER_REWARD_MINOR).toBe(4000);
    expect(FRIEND_REWARD_MINOR).toBe(2000);
  });
});
