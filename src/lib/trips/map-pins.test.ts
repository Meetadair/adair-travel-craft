import { describe, expect, it } from "vitest";

import { boundsOf, buildPins, distanceKm, groupPins, PIN_ORDER } from "./map-pins";
import type { Landmark } from "@/lib/places/landmarks.server";
import type { RankedPlace } from "@/lib/places/types";

const hotel = { name: "Where you're staying", lat: 48.8566, lon: 2.3522 };

const place = (over: Partial<RankedPlace> & { id: string }): RankedPlace =>
  ({
    id: over.id,
    name: over.name ?? "Somewhere",
    categories: over.categories ?? ["restaurant"],
    cuisine: over.cuisine ?? null,
    address: null,
    // "in" rather than ?? so an explicit null survives — the missing-coordinate
    // case is exactly what one of these tests is about.
    lat: "lat" in over ? over.lat : 48.86,
    lon: "lon" in over ? over.lon : 2.35,
    distanceKm: over.distanceKm ?? null,
    website: null,
    phone: null,
    openingHours: null,
    priceBand: null,
    familyFriendly: false,
    source: "map",
    creator: null,
    note: null,
    reason: over.reason ?? "",
    score: 1,
  }) as RankedPlace;

const landmark = (id: string, name: string): Landmark => ({
  id,
  name,
  kind: "museum",
  lat: 48.8606,
  lon: 2.3376,
  distanceKm: 1.2,
});

describe("buildPins", () => {
  it("puts the hotel first, as the anchor", () => {
    const pins = buildPins({ hotel, meeting: null, places: [], landmarks: [] });
    expect(pins[0]?.kind).toBe("hotel");
    expect(pins[0]?.distanceKm).toBeNull();
  });

  it("draws nothing for a hotel with no coordinates", () => {
    const pins = buildPins({
      hotel: { name: "Unknown", lat: null, lon: null },
      meeting: null,
      places: [],
      landmarks: [],
    });
    expect(pins).toHaveLength(0);
  });

  it("keeps the meeting ahead of anything we suggested", () => {
    const pins = buildPins({
      hotel,
      meeting: { label: "Client office", lat: 48.87, lon: 2.33 },
      places: [place({ id: "a" })],
      landmarks: [landmark("m", "A museum")],
    });
    expect(pins.map((pin) => pin.kind)).toEqual(["hotel", "meeting", "eat", "see"]);
  });

  it("measures everything from the hotel", () => {
    const pins = buildPins({
      hotel,
      meeting: { label: "Client office", lat: 48.87, lon: 2.33 },
      places: [],
      landmarks: [],
    });
    expect(pins[1]?.distanceKm).toBeGreaterThan(0);
  });

  it("separates a bar from a restaurant", () => {
    const pins = buildPins({
      hotel,
      meeting: null,
      places: [
        place({ id: "r", categories: ["restaurant"] }),
        place({ id: "b", categories: ["cocktail_bar"] }),
      ],
      landmarks: [],
    });
    expect(pins.find((pin) => pin.id === "r")?.kind).toBe("eat");
    expect(pins.find((pin) => pin.id === "b")?.kind).toBe("drink");
  });

  it("drops a venue with no coordinates rather than pinning the city centre", () => {
    const pins = buildPins({
      hotel,
      meeting: null,
      places: [place({ id: "nowhere", lat: null as never, lon: null as never })],
      landmarks: [],
    });
    expect(pins.some((pin) => pin.id === "nowhere")).toBe(false);
  });

  it("never pins the same place twice", () => {
    const pins = buildPins({
      hotel,
      meeting: null,
      places: [place({ id: "same" }), place({ id: "same" })],
      landmarks: [],
    });
    expect(pins.filter((pin) => pin.id === "same")).toHaveLength(1);
  });

  it("keeps the map readable by capping each kind", () => {
    const many = Array.from({ length: 20 }, (_, index) => place({ id: `p${index}` }));
    const sights = Array.from({ length: 20 }, (_, index) =>
      landmark(`l${index}`, `Sight ${index}`),
    );
    const pins = buildPins({ hotel, meeting: null, places: many, landmarks: sights });
    expect(pins.filter((pin) => pin.kind === "eat")).toHaveLength(8);
    expect(pins.filter((pin) => pin.kind === "see")).toHaveLength(8);
  });
});

describe("groupPins", () => {
  it("groups in a fixed order and drops empty kinds", () => {
    const pins = buildPins({
      hotel,
      meeting: null,
      places: [place({ id: "a" })],
      landmarks: [landmark("m", "A museum")],
    });
    const groups = groupPins(pins).map((group) => group.kind);
    expect(groups).toEqual(["hotel", "eat", "see"]);
    expect(PIN_ORDER.indexOf("hotel")).toBeLessThan(PIN_ORDER.indexOf("see"));
  });
});

describe("boundsOf", () => {
  it("frames every pin", () => {
    const pins = buildPins({
      hotel,
      meeting: { label: "North", lat: 48.9, lon: 2.4 },
      places: [],
      landmarks: [],
    });
    const bounds = boundsOf(pins);
    expect(bounds?.north).toBeCloseTo(48.9);
    expect(bounds?.south).toBeCloseTo(48.8566);
  });

  it("returns nothing when there is nothing to draw", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("distanceKm", () => {
  it("measures a short city hop in hundreds of metres", () => {
    const d = distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 48.8606, lon: 2.3376 });
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(2);
  });
});
