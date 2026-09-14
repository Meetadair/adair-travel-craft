import { describe, expect, it } from "vitest";

import {
  SEED_ROUTES,
  ROUTE_THEMES,
  drivingKmOf,
  drivingMinutesOf,
  stopSummary,
  stopsOf,
  themeLabel,
} from "./routes";

describe("seed routes", () => {
  it("gives every route a unique slug", () => {
    const slugs = SEED_ROUTES.map((route) => route.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("numbers days from one, without gaps", () => {
    for (const route of SEED_ROUTES) {
      const numbers = route.days.map((day) => day.dayNumber);
      expect(numbers).toEqual(numbers.map((_, index) => index + 1));
    }
  });

  it("matches the stated night count to the days written", () => {
    for (const route of SEED_ROUTES) {
      expect(route.days).toHaveLength(route.nights);
    }
  });

  it("only uses themes the filter knows about", () => {
    const known = new Set(ROUTE_THEMES.map((theme) => theme.id));
    for (const route of SEED_ROUTES) {
      for (const theme of route.themes) expect(known.has(theme as never)).toBe(true);
    }
  });

  it("puts every day somewhere real", () => {
    for (const route of SEED_ROUTES) {
      for (const day of route.days) {
        expect(day.city.length).toBeGreaterThan(1);
        expect(Math.abs(day.latitude)).toBeLessThanOrEqual(90);
        expect(Math.abs(day.longitude)).toBeLessThanOrEqual(180);
      }
    }
  });

  it("gives a drive time whenever the traveller moves on", () => {
    for (const route of SEED_ROUTES) {
      for (const day of route.days) {
        if (day.travelNote) expect(day.driveMinutes).toBeGreaterThan(0);
        else expect(day.driveMinutes).toBeNull();
      }
    }
  });

  it("never names a property — where they sleep comes from a live search", () => {
    // A monument called a palace is fine; a capitalised Hotel, Inn or Resort is
    // a property name, and naming one promises a bed we have not checked.
    const propertyName = /\b(Hotel|Inn|Resort|Lodge|Guesthouse|Riad|Villa)\b/;
    for (const route of SEED_ROUTES) {
      for (const day of route.days) {
        const prose = [day.morning, day.afternoon, day.evening, day.onTheRoad]
          .filter(Boolean)
          .join(" ");
        expect(prose).not.toMatch(propertyName);
      }
    }
  });

  it("gives a road distance wherever it gives a drive time", () => {
    for (const route of SEED_ROUTES) {
      for (const day of route.days) {
        if (day.driveMinutes) expect(day.driveKm).toBeGreaterThan(0);
      }
    }
  });
});

describe("derived counts", () => {
  it("counts a two-night town as one stop", () => {
    const route = SEED_ROUTES.find((r) => r.slug === "alentejo-slow");
    expect(route && stopsOf(route.days)).toBe(4);
  });

  it("adds up the driving", () => {
    const route = SEED_ROUTES.find((r) => r.slug === "dolomites-passes");
    expect(route && drivingMinutesOf(route.days)).toBe(390);
    expect(route && drivingKmOf(route.days)).toBe(290);
  });

  it("collapses consecutive nights in one town into a single stop", () => {
    const route = SEED_ROUTES.find((r) => r.slug === "new-york-to-maine");
    expect(route && stopSummary(route.days)).toEqual([
      { city: "New York", nights: 2 },
      { city: "Lexington", nights: 1 },
      { city: "Greenville", nights: 2 },
    ]);
  });
});

describe("themeLabel", () => {
  it("reads a known theme", () => {
    expect(themeLabel("by-the-water")).toBe("By the water");
  });

  it("falls back to the raw value rather than hiding it", () => {
    expect(themeLabel("something-new")).toBe("something-new");
  });
});
