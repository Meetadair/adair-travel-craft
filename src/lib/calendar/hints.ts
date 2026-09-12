/**
 * Turning calendar events into trip hints.
 *
 * Deliberately narrow: an event only counts when it has a location that
 * resolves to a city away from home, starts in the future and isn't a
 * recurring internal meeting or an all-day personal entry. Nothing else about
 * an event is read or kept.
 */
import { findCity, type CityEntry } from "@/lib/trip/cities";

export type RawEvent = {
  id: string;
  title: string;
  location: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  recurring: boolean;
};

export type TripHint = {
  eventId: string;
  title: string;
  location: string;
  city: string;
  iata: string;
  startsAt: string;
  endsAt: string;
};

export function eventToHint(
  event: RawEvent,
  opts: { homeIata: string; now: Date; horizonDays?: number },
): TripHint | null {
  if (event.allDay || event.recurring) return null;
  if (!event.id || !event.location?.trim() || !event.start) return null;

  const start = new Date(event.start);
  if (Number.isNaN(start.getTime()) || start.getTime() <= opts.now.getTime()) return null;
  const horizon = (opts.horizonDays ?? 90) * 24 * 60 * 60 * 1000;
  if (start.getTime() - opts.now.getTime() > horizon) return null;

  const city: CityEntry | null = findCity(event.location.toLowerCase());
  if (!city || city.iata === opts.homeIata.toUpperCase()) return null;

  const end = event.end ? new Date(event.end) : start;
  return {
    eventId: event.id,
    title: event.title?.trim() || "Meeting",
    location: event.location.trim().slice(0, 200),
    city: city.city,
    iata: city.iata,
    startsAt: start.toISOString(),
    endsAt: (Number.isNaN(end.getTime()) ? start : end).toISOString(),
  };
}

export function eventsToHints(
  events: RawEvent[],
  opts: { homeIata: string; now: Date; horizonDays?: number },
): TripHint[] {
  const out: TripHint[] = [];
  for (const event of events) {
    const hint = eventToHint(event, opts);
    if (hint && !out.some((h) => h.eventId === hint.eventId)) out.push(hint);
  }
  return out;
}

const TIME = (iso: string) => iso.slice(11, 16);

/**
 * The sentence we prefill: it carries a must-arrive-by time taken from the
 * event start, so it flows into the backwards planning already built.
 */
export function hintSentence(
  hint: { city: string; startsAt: string; endsAt: string },
  homeCity: string,
): string {
  const day = hint.startsAt.slice(0, 10);
  const back = hint.endsAt.slice(0, 10);
  const arrival = TIME(hint.startsAt);
  const sameDay = day === back;
  return sameDay
    ? `${homeCity} to ${hint.city} on ${day}, I need to be there by ${arrival}, back the same evening.`
    : `${homeCity} to ${hint.city} on ${day}, I need to be there by ${arrival}, back ${back}.`;
}
