/**
 * "Happening while you're there" — real events near the hotel during the
 * trip's dates, from Ticketmaster. Adair never sells or holds a ticket:
 * every card links straight to Ticketmaster's own event page to buy.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { getTripEvents, type TripEvents } from "@/lib/trip-events.functions";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const priceLabel = (
  from: number | null,
  to: number | null,
  currency: string | null,
): string | null => {
  if (from == null || !currency) return null;
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  };
  return to != null && to !== from ? `${fmt(from)}–${fmt(to)}` : `from ${fmt(from)}`;
};

export function TripEventsSection({ tripId }: { tripId: string }) {
  const load = useServerFn(getTripEvents);
  const [data, setData] = useState<TripEvents | null>(null);

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

  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-3.5 text-primary" />
        <h4 className="text-sm font-medium">Happening while you're there</h4>
      </div>

      <ul className="mt-4 space-y-3">
        {data.events.map((event) => (
          <li key={event.id} className="text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{event.name}</span>
              {event.category ? <Chip>{event.category}</Chip> : null}
              <Chip>Ticketmaster</Chip>
            </div>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {dayLabel(event.date)}
              {event.time ? ` · ${event.time}` : ""}
              {event.venueName ? ` · ${event.venueName}` : ""}
              {priceLabel(event.priceFrom, event.priceTo, event.currency)
                ? ` · ${priceLabel(event.priceFrom, event.priceTo, event.currency)}`
                : ""}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
              >
                <ExternalLink className="size-3.5" />
                Buy tickets on Ticketmaster
              </a>
              {event.venueName ? (
                <a
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(event.venueName)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 hover:border-primary"
                >
                  <MapPin className="size-3.5" />
                  Open in maps
                </a>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ticket purchase happens on Ticketmaster — not through Adair.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
