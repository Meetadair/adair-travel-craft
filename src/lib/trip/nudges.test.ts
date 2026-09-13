import { describe, expect, it } from "vitest";
import { pickNudge } from "./nudges";

const base = {
  business: false,
  calendarConnected: true,
  loyaltyCount: 1,
  earnsMiles: false,
  askedForInvoice: false,
  hasDefaultCompany: true,
};

describe("nudges", () => {
  it("suggests the calendar once for a business trip", () => {
    const nudge = pickNudge({ ...base, business: true, calendarConnected: false });
    expect(nudge?.kind).toBe("connect_calendar");
    expect(nudge?.text).toContain("three minutes");
  });

  it("never returns a dismissed nudge", () => {
    const context = { ...base, business: true, calendarConnected: false };
    expect(pickNudge({ ...context, dismissed: ["connect_calendar"] as const })).toBeNull();
  });

  it("shows one nudge at a time, calendar before miles", () => {
    const nudge = pickNudge({
      ...base,
      business: true,
      calendarConnected: false,
      earnsMiles: true,
      loyaltyCount: 0,
    });
    expect(nudge?.kind).toBe("connect_calendar");
    const next = pickNudge({
      ...base,
      business: true,
      calendarConnected: false,
      earnsMiles: true,
      loyaltyCount: 0,
      dismissed: ["connect_calendar"],
    });
    expect(next?.kind).toBe("add_loyalty");
  });

  it("asks to save the company only when an invoice was requested", () => {
    expect(pickNudge({ ...base, askedForInvoice: true, hasDefaultCompany: false })?.kind).toBe(
      "save_company",
    );
    expect(pickNudge({ ...base, hasDefaultCompany: false })).toBeNull();
  });

  it("says nothing when the account is already set up", () => {
    expect(pickNudge({ ...base, business: true })).toBeNull();
  });
});
