/**
 * The answers behind the questions Adair asks in the chat.
 *
 * Every question offers shortcut chips first and a real control underneath, so
 * "this weekend" is one tap and 18 October is still reachable. These helpers
 * are pure so the chips, the calendar and the tests read the same rules.
 */
import { AIRPORTS } from "@/lib/prefs/airports";

export type DateRange = {
  departDate: string;
  returnDate?: string | undefined;
  /**
   * Chosen deliberately, not inferred from a missing return date - one tap
   * on a calendar is an unfinished answer, not a decision to fly one way.
   */
  oneWay?: boolean | undefined;
  /** Days either side the traveller is willing to move, when they said so. */
  flexDays?: number | undefined;
};

export type DateShortcutId = "tomorrow" | "this_weekend" | "next_weekend";

export type DateShortcut = { id: DateShortcutId; range: DateRange };

const DAY = 86_400_000;

const iso = (date: Date): string => date.toISOString().slice(0, 10);

const at = (from: string, days: number): string =>
  iso(new Date(Date.parse(`${from}T00:00:00Z`) + days * DAY));

/** Today, in the traveller's own day, as an ISO date. */
export function today(now: Date = new Date()): string {
  return iso(new Date(now.getTime() - now.getTimezoneOffset() * 60_000));
}

const dayOfWeek = (isoDate: string): number => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

/** Friday to Sunday of the coming weekend; next week's if the weekend has started. */
function weekendFrom(from: string, weeksAhead: number): DateRange {
  const day = dayOfWeek(from);
  // Saturday and Sunday belong to a weekend already under way: aim at the next one.
  const toFriday = day === 6 ? 6 : day === 0 ? 5 : 5 - day;
  const friday = at(from, toFriday + weeksAhead * 7);
  return { departDate: friday, returnDate: at(friday, 2) };
}

/**
 * The three shortcut chips over the calendar. Each one is a real range, so
 * tapping a chip and picking dates by hand end in the same place.
 */
export function dateShortcuts(from: string = today()): DateShortcut[] {
  return [
    { id: "this_weekend", range: weekendFrom(from, 0) },
    { id: "next_weekend", range: weekendFrom(from, 1) },
    { id: "tomorrow", range: { departDate: at(from, 1) } },
  ];
}

/** Common arrival times, offered as chips over the time picker. */
export const TIME_SHORTCUTS = ["09:00", "12:00", "18:00"] as const;

/** True for a date already gone — those days are never selectable. */
export function isPastDate(date: string, from: string = today()): boolean {
  return date < from;
}

/** Months the calendar may show: this one and the eleven after it. */
export function monthRange(from: string = today()): { start: string; end: string } {
  const start = `${from.slice(0, 7)}-01`;
  const [year, month] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
  const endYear = month === 1 ? year : year + 1;
  const endMonth = month === 1 ? 12 : month - 1;
  return { start, end: `${endYear}-${String(endMonth).padStart(2, "0")}-01` };
}

/**
 * A chosen range, folded back into the sentence so the parser stays the one
 * reader of what the traveller wants.
 */
/**
 * A trip has two ends. A one-way date is an unfinished answer, not a choice:
 * the search would run with a return date we invented, and the traveller would
 * find out at the airport. Anything that accepts a range checks this first.
 */
export function isCompleteRange(range: DateRange | null | undefined): boolean {
  if (!range?.departDate) return false;
  // A one-way is finished the moment the outbound day is picked.
  if (range.oneWay) return true;
  if (!range.returnDate) return false;
  return range.returnDate >= range.departDate;
}

/** The date n nights after the departure, in ISO. */
export function addDaysIso(iso: string, nights: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + nights);
  return date.toISOString().slice(0, 10);
}

/** Whole nights between two ISO dates. A day trip is zero. */
export function nightsBetween(depart: string, back: string): number {
  const a = new Date(`${depart}T00:00:00Z`).getTime();
  const b = new Date(`${back}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function rangeSentence(range: DateRange): string {
  // Both choices are spelled out so the parser reads them back out of the
  // sentence, exactly as it would from something the traveller typed.
  const flex = range.flexDays ? `, +/- ${range.flexDays} days` : "";
  if (range.oneWay) return `on ${range.departDate}, one way${flex}`;
  if (!range.returnDate || range.returnDate === range.departDate) {
    return `on ${range.departDate}${flex}`;
  }
  return `from ${range.departDate} to ${range.returnDate}${flex}`;
}

/** An arrival time, folded back into the sentence the same way. */
export function timeSentence(time: string): string {
  return `there by ${time}`;
}

export type AirportMatch = { iata: string; label: string };

/**
 * The searchable airport list: matches on code, city, country or airport name,
 * so "mila", "MXP" and "Malpensa" all find the same airport.
 */
export function searchAirports(query: string, limit = 8): AirportMatch[] {
  const needle = query.trim().toLowerCase();
  const scored = AIRPORTS.map((airport) => {
    const label = `${airport.city} (${airport.iata})`;
    if (!needle) return { iata: airport.iata, label, score: 2 };
    const code = airport.iata.toLowerCase();
    if (code === needle) return { iata: airport.iata, label, score: 0 };
    if (airport.city.toLowerCase().startsWith(needle))
      return { iata: airport.iata, label, score: 1 };
    if (
      code.includes(needle) ||
      airport.city.toLowerCase().includes(needle) ||
      airport.country.toLowerCase().includes(needle) ||
      airport.name.toLowerCase().includes(needle)
    ) {
      return { iata: airport.iata, label, score: 2 };
    }
    return null;
  }).filter((match): match is { iata: string; label: string; score: number } => match !== null);

  return scored
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ iata, label }) => ({ iata, label }));
}
