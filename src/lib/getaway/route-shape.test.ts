import { describe, expect, it } from "vitest";

import { legKm, routeShape, toPlane, type ShapeStop } from "./route-shape";

const stop = (city: string, latitude: number, longitude: number): ShapeStop => ({
  city,
  nights: 1,
  latitude,
  longitude,
});

/** New York, Lexington (MA), Greenville (ME) — the legs are 330 and 420 km. */
const newEngland = [
  stop("New York", 40.7128, -74.006),
  stop("Lexington", 42.4473, -71.2245),
  stop("Greenville", 45.4592, -69.5953),
];

describe("toPlane", () => {
  it("puts the first stop at the origin", () => {
    expect(toPlane(newEngland)[0]).toEqual({ x: 0, y: -0 });
  });

  it("sends north upwards on screen", () => {
    const [, second] = toPlane(newEngland);
    expect(second!.y).toBeLessThan(0);
  });

  it("handles an empty route", () => {
    expect(toPlane([])).toEqual([]);
  });
});

describe("legKm", () => {
  it("measures a leg to within a sensible margin", () => {
    const km = legKm(newEngland[0]!, newEngland[1]!);
    // Straight line is shorter than the 330 km of road, as it should be.
    expect(km).toBeGreaterThan(250);
    expect(km).toBeLessThan(320);
  });
});

describe("routeShape", () => {
  it("returns nothing for an empty route", () => {
    expect(routeShape([])).toBeNull();
  });

  it("draws a point per stop, in order", () => {
    const shape = routeShape(newEngland)!;
    expect(shape.points.map((point) => point.city)).toEqual([
      "New York",
      "Lexington",
      "Greenville",
    ]);
  });

  it("keeps every point inside the box", () => {
    const shape = routeShape(newEngland, { width: 600, height: 200, padding: 30 })!;
    for (const point of shape.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(600);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(200);
    }
  });

  it("draws a longer leg longer — the whole point of the shape", () => {
    const shape = routeShape(newEngland)!;
    const [a, b, c] = shape.points;
    const first = Math.hypot(b!.x - a!.x, b!.y - a!.y);
    const second = Math.hypot(c!.x - b!.x, c!.y - b!.y);
    // 420 km against 330 km on the road, and the drawing must agree.
    expect(second).toBeGreaterThan(first);
  });

  it("scales both axes equally, so the route is not distorted", () => {
    const shape = routeShape(newEngland)!;
    const [a, b, c] = shape.points;
    const drawnRatio = Math.hypot(c!.x - b!.x, c!.y - b!.y) / Math.hypot(b!.x - a!.x, b!.y - a!.y);
    const realRatio = legKm(newEngland[1]!, newEngland[2]!) / legKm(newEngland[0]!, newEngland[1]!);
    expect(drawnRatio).toBeCloseTo(realRatio, 1);
  });

  it("survives a route that runs perfectly straight", () => {
    const straight = [stop("A", 50, 10), stop("B", 50, 12), stop("C", 50, 14)];
    const shape = routeShape(straight)!;
    expect(shape.points).toHaveLength(3);
    expect(shape.points.every((point) => Number.isFinite(point.x))).toBe(true);
  });

  it("survives a single stop", () => {
    const shape = routeShape([stop("Alone", 48, 2)])!;
    expect(shape.points).toHaveLength(1);
    expect(Number.isFinite(shape.points[0]!.x)).toBe(true);
  });

  it("writes a path through every stop", () => {
    const shape = routeShape(newEngland)!;
    expect(shape.path.startsWith("M")).toBe(true);
    expect(shape.path.match(/L/g)).toHaveLength(2);
  });
});

describe("adaptive height", () => {
  it("gives a north-south route a taller box than an east-west one", () => {
    const northSouth = [stop("A", 40, 10), stop("B", 46, 10.5)];
    const eastWest = [stop("C", 45, 5), stop("D", 45.3, 15)];
    const tall = routeShape(northSouth, { width: 640 })!;
    const wide = routeShape(eastWest, { width: 640 })!;
    expect(tall.height).toBeGreaterThan(wide.height);
  });

  it("still honours an explicit height", () => {
    expect(routeShape(newEngland, { width: 640, height: 200 })!.height).toBe(200);
  });

  it("keeps the box within sane bounds", () => {
    const extreme = [stop("A", 10, 10), stop("B", 60, 10.01)];
    const shape = routeShape(extreme, { width: 640, maxHeight: 420 })!;
    expect(shape.height).toBeLessThanOrEqual(420);
    expect(shape.height).toBeGreaterThanOrEqual(120);
  });
});
