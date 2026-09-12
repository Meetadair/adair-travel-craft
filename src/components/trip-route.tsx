/**
 * "Show on map": route map plus the ordered stop list, with drag or
 * up/down reordering and the total distance of the route as ordered.
 */
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, MapPin } from "lucide-react";
import { bestOrderDistanceKm, routeDistanceKm } from "@/lib/trip/geo";
import type { TripStop } from "@/lib/trip/types";

const TripMapLeaflet = lazy(() => import("./trip-map-leaflet"));

const MapFallback = ({ stops }: { stops: TripStop[] }) => (
  <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
    <p>Map loading — the route in order:</p>
    <p className="mt-1 font-medium text-foreground">
      {stops.map((s) => `${s.city} (${s.iata})`).join(" → ")}
    </p>
  </div>
);

export function TripRoute({
  stops,
  onReorder,
  reordering,
}: {
  stops: TripStop[];
  /** Omit to render a read-only route. */
  onReorder?: (next: TripStop[]) => void;
  reordering?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const distance = routeDistanceKm(stops);
  const shortest = bestOrderDistanceKm(stops);
  const detour = distance - shortest;

  const move = (from: number, to: number) => {
    if (!onReorder || to < 0 || to >= stops.length || from === to) return;
    const next = [...stops];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onReorder(next);
  };

  /** Finger/pen dragging: find the stop under the pointer and drop there. */
  const indexUnderPointer = (x: number, y: number) => {
    const node = document.elementFromPoint(x, y)?.closest("[data-stop-index]");
    const raw = node?.getAttribute("data-stop-index");
    return raw === null || raw === undefined ? null : Number(raw);
  };

  const handlePointerDown = (index: number) => (event: React.PointerEvent) => {
    if (!onReorder) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    setDragIndex(index);
    setOverIndex(index);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (dragIndex === null) return;
    const target = indexUnderPointer(event.clientX, event.clientY);
    if (target !== null) setOverIndex(target);
  };

  const handlePointerUp = () => {
    if (dragIndex !== null && overIndex !== null) move(dragIndex, overIndex);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-4">
      <ClientOnly fallback={<MapFallback stops={stops} />}>
        <Suspense fallback={<MapFallback stops={stops} />}>
          <TripMapLeaflet stops={stops} />
        </Suspense>
      </ClientOnly>

      <ol className="space-y-2">
        {stops.map((stop, index) => (
          <li
            key={`${stop.iata}-${index}`}
            draggable={Boolean(onReorder)}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => onReorder && e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
            }}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
          >
            {onReorder && (
              <GripVertical className="hidden size-4 shrink-0 cursor-grab text-muted-foreground sm:block" />
            )}
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{stop.city}</span>{" "}
              <span className="text-muted-foreground">({stop.iata})</span>
              {index > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {routeDistanceKm([stops[index - 1]!, stop]).toLocaleString()} km
                </span>
              )}
            </span>
            {onReorder && (
              <span className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Move ${stop.city} earlier`}
                  disabled={index === 0 || reordering}
                  onClick={() => move(index, index - 1)}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${stop.city} later`}
                  disabled={index === stops.length - 1 || reordering}
                  onClick={() => move(index, index + 1)}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <MapPin className="size-3.5 text-primary" />
        <span>
          <span className="font-medium text-foreground">
            {distance.toLocaleString()} km
          </span>{" "}
          in this order
        </span>
        {detour > 150 && (
          <span>
            · about {detour.toLocaleString()} km more than the tidiest order — try moving a stop.
          </span>
        )}
        {reordering && <span>· re-checking prices…</span>}
      </p>
    </div>
  );
}
