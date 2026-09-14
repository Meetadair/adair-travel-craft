/**
 * The map section on a booked trip.
 *
 * Map first, then the same pins as a list underneath — because a list can be
 * read on a phone in a taxi and a map cannot. Distances are from the hotel and
 * approximate, and nothing here claims a place is open.
 */
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { MapPin as PinIcon } from "lucide-react";
import { getTripMap } from "@/lib/trip-map.functions";
import { PIN_COLOUR, PIN_LABEL, groupPins } from "@/lib/trips/map-pins";

const TripCityMap = lazy(() => import("./trip-city-map"));

export function TripMapSection({ tripId }: { tripId: string }) {
  const load = useServerFn(getTripMap);
  const map = useQuery({
    queryKey: ["trip-map", tripId],
    queryFn: () => load({ data: { tripId } }),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const data = map.data;
  if (map.isLoading) {
    return <p className="mt-6 text-sm text-muted-foreground">Drawing the map…</p>;
  }
  if (!data || data.pins.length === 0) return null;

  const groups = groupPins(data.pins);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <PinIcon className="size-4 text-primary" />
        <h3 className="font-display text-lg font-semibold">
          {data.city ? `Around your stay in ${data.city}` : "Around your stay"}
        </h3>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {data.anchored
          ? "Distances are from your hotel, in a straight line."
          : "We don't have the hotel's exact position yet, so distances are from the city centre."}
      </p>

      <div className="mt-4">
        <ClientOnly fallback={<div className="h-72 w-full rounded-xl border border-border" />}>
          <Suspense fallback={<div className="h-72 w-full rounded-xl border border-border" />}>
            <TripCityMap pins={data.pins} />
          </Suspense>
        </ClientOnly>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {groups.map((group) => (
          <li key={group.kind} className="flex items-center gap-2 text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: PIN_COLOUR[group.kind] }}
            />
            {PIN_LABEL[group.kind]}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-5">
        {groups
          .filter((group) => group.kind !== "hotel")
          .map((group) => (
            <div key={group.kind}>
              <h4 className="text-sm font-semibold">{PIN_LABEL[group.kind]}</h4>
              <ul className="mt-2 space-y-1.5">
                {group.pins.map((pin) => (
                  <li key={pin.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm">
                      {pin.name}
                      {pin.detail && <span className="text-muted-foreground"> · {pin.detail}</span>}
                    </span>
                    {pin.distanceKm !== null && (
                      <span className="text-sm text-muted-foreground">
                        {pin.distanceKm < 1
                          ? `${Math.round(pin.distanceKm * 1000)} m`
                          : `${pin.distanceKm} km`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{data.attribution}</p>
    </section>
  );
}
