import { describe, expect, it } from "vitest";

import { detectTripContext, hasBusinessOverrides, prefsForContext } from "./context";

describe("detectTripContext", () => {
  it("reads a meeting as business", () => {
    expect(detectTripContext("Milan Thursday, client meeting")).toBe("business");
    expect(detectTripContext("Berlin, spotkanie z klientem")).toBe("business");
  });

  it("reads a holiday as leisure", () => {
    expect(detectTripContext("A week on the beach in Sardinia")).toBe("leisure");
    expect(detectTripContext("wakacje w Chorwacji")).toBe("leisure");
  });

  it("treats a company invoice as business regardless of wording", () => {
    expect(detectTripContext("Sardinia, on the company", { invoiceToCompany: true })).toBe(
      "business",
    );
  });

  it("lets a holiday win over a meeting mentioned in passing", () => {
    // "Beach after the conference" is a holiday with a meeting attached.
    expect(detectTripContext("conference first, then the beach for a week")).toBe("leisure");
  });

  it("reads a hard arrival time as a meeting in disguise", () => {
    expect(detectTripContext("Berlin on Thursday", { mustArriveBy: "15:00" })).toBe("business");
  });

  it("defaults to leisure — guessing business books the wrong hotel", () => {
    expect(detectTripContext("Berlin on Thursday")).toBe("leisure");
  });
});

describe("prefsForContext", () => {
  const base = {
    cabinClass: "economy",
    hotelTypes: ["boutique"],
    hotelMaxKm: null,
    seat: "window",
    cuisines: ["italian"],
  };

  it("returns the base untouched on a leisure trip", () => {
    const merged = prefsForContext(base, { cabinClass: "business" }, "leisure");
    expect(merged).toBe(base);
  });

  it("applies the overlay on a business trip", () => {
    const merged = prefsForContext(base, { cabinClass: "business", hotelMaxKm: 2 }, "business");
    expect(merged.cabinClass).toBe("business");
    expect(merged.hotelMaxKm).toBe(2);
  });

  it("lets empty overlay values fall through to the person", () => {
    const merged = prefsForContext(base, { hotelTypes: [], cabinClass: "" }, "business");
    expect(merged.hotelTypes).toEqual(["boutique"]);
    expect(merged.cabinClass).toBe("economy");
  });

  it("never touches fields outside the overlay's remit", () => {
    const merged = prefsForContext(base, { cuisines: ["steakhouse"] } as never, "business");
    // Taste in food is the person, not the trip.
    expect(merged.cuisines).toEqual(["italian"]);
  });

  it("never mutates the base", () => {
    prefsForContext(base, { cabinClass: "business" }, "business");
    expect(base.cabinClass).toBe("economy");
  });
});

describe("hasBusinessOverrides", () => {
  it("sees an empty overlay for what it is", () => {
    expect(hasBusinessOverrides({})).toBe(false);
    expect(hasBusinessOverrides({ hotelTypes: [], cabinClass: "" })).toBe(false);
    expect(hasBusinessOverrides(null)).toBe(false);
  });

  it("sees a real override", () => {
    expect(hasBusinessOverrides({ cabinClass: "business" })).toBe(true);
  });
});

describe("a stated purpose beats the wording", () => {
  it("treats a trip the traveller called personal as leisure, conference or not", () => {
    expect(
      detectTripContext("Vienna for the weekend, near the conference centre", {
        purpose: "personal",
      }),
    ).toBe("leisure");
  });

  it("treats a stated business trip as business even when it sounds like a holiday", () => {
    expect(detectTripContext("a few days by the beach in Nice", { purpose: "business" })).toBe(
      "business",
    );
  });

  it("still guesses when nothing was stated", () => {
    expect(detectTripContext("Milan for a client meeting")).toBe("business");
    expect(detectTripContext("a week in Crete")).toBe("leisure");
  });

  it("lets a stated personal purpose override an invoice to the company", () => {
    expect(
      detectTripContext("Berlin Thursday", { purpose: "personal", invoiceToCompany: true }),
    ).toBe("leisure");
  });
});
