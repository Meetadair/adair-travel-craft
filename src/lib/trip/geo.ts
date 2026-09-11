/** Great-circle distances for the multi-city route view. */
import type { TripStop } from "./types";

const R = 6371; // km

export function distanceKm(a: TripStop, b: TripStop): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Total length of the route, skipping stops without coordinates. */
export function routeDistanceKm(stops: TripStop[]): number {
  const usable = stops.filter((s) => s.lat !== 0 || s.lon !== 0);
  let total = 0;
  for (let i = 1; i < usable.length; i += 1) total += distanceKm(usable[i - 1]!, usable[i]!);
  return total;
}

/** Shortest route through the same stops, keeping the first one fixed. */
export function bestOrderDistanceKm(stops: TripStop[]): number {
  const usable = stops.filter((s) => s.lat !== 0 || s.lon !== 0);
  if (usable.length < 3) return routeDistanceKm(usable);
  const [start, ...rest] = usable;
  const visited: TripStop[] = [start!];
  const pool = [...rest];
  let total = 0;
  while (pool.length) {
    const current = visited[visited.length - 1]!;
    let bestIndex = 0;
    let bestDistance = Infinity;
    pool.forEach((stop, index) => {
      const d = distanceKm(current, stop);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    total += bestDistance;
    visited.push(pool.splice(bestIndex, 1)[0]!);
  }
  return total;
}
