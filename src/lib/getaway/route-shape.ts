/**
 * The shape of a route, drawn to scale.
 *
 * Stops spaced evenly along a bar are a diagram; stops placed where they
 * actually are is a route. A traveller reading "New York, Lexington,
 * Greenville" learns more from seeing the second leg is longer than the first
 * than from any number beside it.
 *
 * Equirectangular projection with a cosine correction for latitude — accurate
 * enough over a few hundred kilometres, and it keeps relative distances honest,
 * which is the whole point. Pure; safe on the client.
 */

export type ShapeStop = {
  city: string;
  nights: number;
  latitude: number;
  longitude: number;
};

export type ShapePoint = {
  city: string;
  nights: number;
  /** Position inside the viewBox. */
  x: number;
  y: number;
  /** Where the label sits relative to the dot, so labels avoid the line. */
  labelBelow: boolean;
};

export type RouteShape = {
  width: number;
  height: number;
  points: ShapePoint[];
  /** SVG path through every stop, in travel order. */
  path: string;
};

const EARTH_KM_PER_DEGREE = 111.32;

/** Kilometres east and north of the first stop, so the shape is to scale. */
export function toPlane(stops: ShapeStop[]): Array<{ x: number; y: number }> {
  const origin = stops[0];
  if (!origin) return [];
  const midLat =
    (Math.min(...stops.map((s) => s.latitude)) + Math.max(...stops.map((s) => s.latitude))) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  return stops.map((stop) => ({
    x: (stop.longitude - origin.longitude) * EARTH_KM_PER_DEGREE * lonScale,
    // Screen y grows downwards, north does not.
    y: -(stop.latitude - origin.latitude) * EARTH_KM_PER_DEGREE,
  }));
}

/**
 * Fits the route into a box without distorting it: one scale for both axes, so
 * a leg twice as long is drawn twice as long.
 *
 * A route that runs almost straight would otherwise collapse to a line of zero
 * height, so a minimum spread keeps it drawable.
 */
export function routeShape(
  stops: ShapeStop[],
  options: {
    width?: number;
    /** Fixed height. Omit to let the box follow the route's own proportions. */
    height?: number;
    padding?: number;
    minHeight?: number;
    maxHeight?: number;
  } = {},
): RouteShape | null {
  if (stops.length === 0) return null;

  const width = options.width ?? 640;
  const padding = options.padding ?? 34;
  const minHeight = options.minHeight ?? 120;
  const maxHeight = options.maxHeight ?? 420;

  const plane = toPlane(stops);
  const xs = plane.map((point) => point.x);
  const ys = plane.map((point) => point.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);

  /**
   * A north–south route in a wide box is a thin diagonal with empty space on
   * both sides. Letting the box follow the route's own proportions fills the
   * space without stretching anything — the scale stays equal on both axes.
   */
  const height =
    options.height ??
    Math.round(
      Math.min(
        maxHeight,
        Math.max(
          minHeight,
          spanX === 0 ? maxHeight : (spanY / spanX) * (width - padding * 2) + padding * 2,
        ),
      ),
    );

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  // One scale for both axes keeps the proportions true.
  const scale =
    spanX === 0 && spanY === 0
      ? 1
      : Math.min(
          spanX === 0 ? Number.POSITIVE_INFINITY : usableWidth / spanX,
          spanY === 0 ? Number.POSITIVE_INFINITY : usableHeight / spanY,
        );

  const drawnWidth = spanX * scale;
  const drawnHeight = spanY * scale;
  const offsetX = padding + (usableWidth - drawnWidth) / 2;
  const offsetY = padding + (usableHeight - drawnHeight) / 2;

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  const points: ShapePoint[] = stops.map((stop, index) => {
    const planePoint = plane[index]!;
    const x = offsetX + (planePoint.x - minX) * scale;
    const y = offsetY + (planePoint.y - minY) * scale;
    // Labels go on the outside of the bend, so they never sit across the line.
    const previous = plane[index - 1];
    const next = plane[index + 1];
    const neighbourY = ((previous?.y ?? planePoint.y) + (next?.y ?? planePoint.y)) / 2;
    return {
      city: stop.city,
      nights: stop.nights,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      labelBelow: planePoint.y >= neighbourY,
    };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  return { width, height, points, path };
}

/** Straight-line kilometres between two stops, for the leg labels. */
export function legKm(a: ShapeStop, b: ShapeStop): number {
  const [pa, pb] = toPlane([a, b]);
  if (!pa || !pb) return 0;
  return Math.round(Math.hypot(pb.x - pa.x, pb.y - pa.y));
}
