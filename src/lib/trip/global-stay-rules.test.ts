import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLOBAL_STAY_RULES,
  passesGlobalStayRules,
  staysPassingGlobalRules,
} from "@/lib/trip/global-stay-rules";
import { DEALBREAKER_FIELDS } from "@/lib/prefs/questions";

describe("global stay rules apply to everyone", () => {
  it("never offers a hostel, a dorm, a shared bathroom or a smoking room", () => {
    for (const text of [
      "Krakow Backpacker Hostel",
      "City Hostel — mixed dorm, 6 beds",
      "Guest room with shared bathroom",
      "Double room, smoking room",
    ]) {
      expect(passesGlobalStayRules({ text })).toBe(false);
    }
  });

  it("keeps hotels, apartments, villas and resorts", () => {
    for (const stay of [
      { text: "Hotel Bristol", propertyType: "hotel" },
      { text: "Old Town Apartment", propertyType: "apartment" },
      { text: "Villa Serena", propertyType: "villa" },
      { text: "Beach Resort & Spa", propertyType: "resort" },
    ]) {
      expect(passesGlobalStayRules(stay)).toBe(true);
    }
  });

  it("drops property types below that standard", () => {
    expect(passesGlobalStayRules({ text: "Casa Verde", propertyType: "campsite" })).toBe(false);
    expect(passesGlobalStayRules({ text: "Casa Verde", propertyType: "capsule" })).toBe(false);
  });

  it("does not judge a property type the supplier never published", () => {
    expect(passesGlobalStayRules({ text: "Casa Verde", propertyType: null })).toBe(true);
  });

  it("respects a rule the team switched off in the config", () => {
    const rules = DEFAULT_GLOBAL_STAY_RULES.map((rule) =>
      rule.ruleKey === "no_hostel" ? { ...rule, enabled: false } : rule,
    );
    expect(passesGlobalStayRules({ text: "City Hostel" }, rules)).toBe(true);
  });

  it("filters a result list before ranking", () => {
    const stays = [{ name: "Hotel Bristol" }, { name: "City Hostel" }];
    expect(staysPassingGlobalRules(stays, (s) => ({ text: s.name }))).toEqual([
      { name: "Hotel Bristol" },
    ]);
  });

  it("no longer asks the customer about hostels, shared baths or smoking", () => {
    for (const field of ["dbNoHostel", "dbSharedBath", "dbNonSmoking"]) {
      expect(DEALBREAKER_FIELDS as readonly string[]).not.toContain(field);
    }
  });
});
