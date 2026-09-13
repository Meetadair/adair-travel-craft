/**
 * "Places to go out" on a booked trip, grouped by time of day. Every entry
 * carries its source, so nobody mistakes a map listing for a recommendation.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coffee, ExternalLink, MapPin, Phone, Check } from "lucide-react";
import { getTripPlaces, markGoingThere, type TripPlaces } from "@/lib/places.functions";
import { CATEGORY_LABEL, SOURCE_LABEL, type RankedPlace } from "@/lib/places/types";

const mapsHref = (place: RankedPlace) =>
  place.lat != null && place.lon != null
    ? `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(place.name)}`;

const DEFAULT_TIME: Record<string, string> = {
  morning: "09:30",
  evening: "19:30",
  late: "22:00",
  night: "23:30",
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function TripPlaces({ tripId }: { tripId: string }) {
  const load = useServerFn(getTripPlaces);
  const going = useServerFn(markGoingThere);
  const [data, setData] = useState<TripPlaces | null>(null);
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    void load({ data: { tripId } })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [tripId, load]);

  if (!data || !data.any) return null;

  const mark = async (place: RankedPlace, date: string, bucket: string) => {
    setMarked((prev) => ({ ...prev, [place.id]: true }));
    try {
      await going({
        data: {
          tripId,
          name: place.name,
          date,
          time: DEFAULT_TIME[bucket] ?? "19:30",
          category: place.categories[0] ?? "restaurant",
          address: place.address,
          website: place.website,
        },
      });
    } catch {
      setMarked((prev) => ({ ...prev, [place.id]: false }));
    }
  };

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <Coffee className="size-3.5 text-primary" />
        <h4 className="text-sm font-medium">Places to go out</h4>
      </div>

      <div className="mt-4 space-y-5">
        {data.sections.map((section) => (
          <section key={`${section.date}-${section.bucket}`}>
            <p className="text-xs font-medium text-foreground">{section.label}</p>
            <ul className="mt-2 space-y-3">
              {section.places.map((place) => (
                <li key={place.id} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{place.name}</span>
                    <Chip>{CATEGORY_LABEL[place.categories[0] ?? "restaurant"]}</Chip>
                    {place.cuisine ? <Chip>{place.cuisine}</Chip> : null}
                    <Chip>{SOURCE_LABEL[place.source]}</Chip>
                  </div>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{place.reason}</p>
                  {place.openingHours ? (
                    <p className="mt-0.5 text-muted-foreground">Open: {place.openingHours}</p>
                  ) : null}
                  {place.priceBand ? null : (
                    <p className="mt-0.5 text-muted-foreground">Price not known</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {place.categories[0] === "restaurant" && (place.website || place.phone) ? (
                      <a
                        href={place.website ?? `tel:${place.phone}`}
                        target={place.website ? "_blank" : undefined}
                        rel={place.website ? "noreferrer" : undefined}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
                      >
                        {place.website ? (
                          <ExternalLink className="size-3.5" />
                        ) : (
                          <Phone className="size-3.5" />
                        )}
                        Reserve
                      </a>
                    ) : null}
                    <a
                      href={mapsHref(place)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
                    >
                      <MapPin className="size-3.5" />
                      Open in maps
                    </a>
                    <button
                      type="button"
                      onClick={() => void mark(place, section.date, section.bucket)}
                      disabled={marked[place.id]}
                      className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary disabled:opacity-60"
                    >
                      <Check className="size-3.5" />
                      {marked[place.id] ? "On your trip" : "Going there"}
                    </button>
                  </div>

                  {place.categories[0] === "restaurant" ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Reservation directly with the restaurant.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {data.usesMapData && (
        <p className="mt-4 text-[11px] text-muted-foreground">{data.attribution}</p>
      )}
    </div>
  );
}
