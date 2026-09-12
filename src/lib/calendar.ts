/**
 * Calendar helpers: turn a booked trip into calendar events, then into an
 * .ics file (Apple / Outlook) or a Google Calendar "add event" link.
 * Pure data — no supplier calls, no account connection, no OAuth.
 */

export type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  /** "YYYY-MM-DD" when allDay, otherwise a local datetime "YYYY-MM-DDTHH:mm". */
  start: string;
  end: string;
  allDay: boolean;
};

/** What we persist on a trip item so the calendar can be rebuilt later. */
export type ItemCalendarPayload = {
  route?: string;
  returnRoute?: string;
  departAt?: string | null;
  arriveAt?: string | null;
  returnDepartAt?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  address?: string | null;
  location?: string | null;
  /** Rides: local pickup time and the two addresses. */
  pickupAt?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  /** Restaurants: local reservation time, party size and venue. */
  reservationAt?: string | null;
  partySize?: number | null;
  venueName?: string | null;
  cuisine?: string | null;
  /** Loyalty membership carried on the line, masked for display. */
  loyaltyProgramme?: string | null;
  loyaltyMemberMasked?: string | null;
  /** Free-text note stored with the line (e.g. the insurance offer wording). */
  note?: string | null;
  /** Flight extras: the supplier service booked and how many. */
  serviceId?: string | null;
  quantity?: number | null;
};

type TripLike = {
  id: string;
  title: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  reference: string | null;
  items: Array<{
    id: string;
    kind: string;
    title: string;
    status: string;
    reference: string | null;
    payload?: ItemCalendarPayload | null;
  }>;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local datetime → "20260915T083000"; drops any timezone marker. */
function stampLocal(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return `${y}${m}${d}T${h}${min}00`;
}

/** "2026-09-15" → "20260915". */
function stampDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}${match[2]}${match[3]}` : null;
}

/** Same day, at a fixed local hour. */
function atHour(date: string, hour: number): string | null {
  return /^\d{4}-\d{2}-\d{2}/.test(date) ? `${date.slice(0, 10)}T${pad(hour)}:00` : null;
}

function plusHours(local: string, hours: number): string {
  const d = new Date(`${local}:00`);
  d.setHours(d.getHours() + hours);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Every calendar event for one booked trip, in chronological order. */
export function tripCalendarEvents(trip: TripLike): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const ref = trip.reference ? `Booking reference ${trip.reference}` : "Booked with Adair";

  for (const item of trip.items) {
    if (item.status === "cancelled" || item.status === "failed") continue;
    const p = item.payload ?? {};
    const detail = [ref, item.reference ? `Item reference ${item.reference}` : null]
      .filter(Boolean)
      .join("\n");

    if (item.kind === "flight") {
      const route = p.route ?? [trip.city].filter(Boolean).join("");
      if (p.departAt) {
        const start = p.departAt.slice(0, 16);
        const end = p.arriveAt ? p.arriveAt.slice(0, 16) : plusHours(start, 2);
        events.push({
          uid: `${item.id}-out`,
          title: `Flight ${route} · ${item.title}`,
          description: detail,
          location: route,
          start,
          end,
          allDay: false,
        });
      }
      if (p.returnDepartAt) {
        const start = p.returnDepartAt.slice(0, 16);
        events.push({
          uid: `${item.id}-back`,
          title: `Return flight ${p.returnRoute ?? route} · ${item.title}`,
          description: detail,
          location: p.returnRoute ?? route,
          start,
          end: plusHours(start, 2),
          allDay: false,
        });
      }
      continue;
    }

    if (item.kind === "stay" || item.kind === "hotel") {
      const checkin = p.checkin ?? trip.startDate;
      const checkout = p.checkout ?? trip.endDate;
      const location = p.address ?? trip.city ?? "";
      const inAt = checkin ? atHour(checkin, 15) : null;
      if (inAt) {
        events.push({
          uid: `${item.id}-checkin`,
          title: `Hotel check-in · ${item.title}`,
          description: detail,
          location,
          start: inAt,
          end: plusHours(inAt, 1),
          allDay: false,
        });
      }
      const outAt = checkout ? atHour(checkout, 10) : null;
      if (outAt) {
        events.push({
          uid: `${item.id}-checkout`,
          title: `Hotel check-out · ${item.title}`,
          description: detail,
          location,
          start: outAt,
          end: plusHours(outAt, 1),
          allDay: false,
        });
      }
      continue;
    }

    if (item.kind === "ride") {
      const start = p.pickupAt ? p.pickupAt.slice(0, 16) : null;
      if (start) {
        const route = [p.pickupAddress, p.dropoffAddress].filter(Boolean).join(" → ");
        events.push({
          uid: `${item.id}-ride`,
          title: `Transfer · ${item.title}`,
          description: [detail, route].filter(Boolean).join("\n"),
          location: p.pickupAddress ?? trip.city ?? "",
          start,
          end: plusHours(start, 1),
          allDay: false,
        });
      }
      continue;
    }

    if (item.kind === "restaurant") {
      const start = p.reservationAt ? p.reservationAt.slice(0, 16) : null;
      if (start) {
        const party = p.partySize ? `Table for ${p.partySize}` : null;
        events.push({
          uid: `${item.id}-table`,
          title: `Dinner · ${p.venueName ?? item.title}`,
          description: [detail, party, p.cuisine].filter(Boolean).join("\n"),
          location: p.address ?? trip.city ?? "",
          start,
          end: plusHours(start, 2),
          allDay: false,
        });
      }
      continue;
    }

    if (item.kind === "car") {
      const location = p.location ?? trip.city ?? "";
      const pickup = p.pickup ?? trip.startDate;
      const dropoff = p.dropoff ?? trip.endDate;
      const pickAt = pickup ? atHour(pickup, 12) : null;
      if (pickAt) {
        events.push({
          uid: `${item.id}-pickup`,
          title: `Car pick-up · ${item.title}`,
          description: detail,
          location,
          start: pickAt,
          end: plusHours(pickAt, 1),
          allDay: false,
        });
      }
      const dropAt = dropoff ? atHour(dropoff, 10) : null;
      if (dropAt) {
        events.push({
          uid: `${item.id}-dropoff`,
          title: `Car drop-off · ${item.title}`,
          description: detail,
          location,
          start: dropAt,
          end: plusHours(dropAt, 1),
          allDay: false,
        });
      }
    }
  }

  return events.sort((a, b) => a.start.localeCompare(b.start));
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines to 75 octets as iCalendar requires. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

/** A complete .ics document with 24 h and 2 h reminders on every event. */
export function buildIcs(events: CalendarEvent[], calendarName = "Adair trip"): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Adair//Trips//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    const start = event.allDay ? stampDate(event.start) : stampLocal(event.start);
    const end = event.allDay ? stampDate(event.end) : stampLocal(event.end);
    if (!start || !end) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}@adair.travel`);
    lines.push(`DTSTAMP:${dtstamp}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    for (const [trigger, label] of [
      ["-PT24H", "Tomorrow"],
      ["-PT2H", "In 2 hours"],
    ] as const) {
      lines.push("BEGIN:VALARM");
      lines.push(`TRIGGER:${trigger}`);
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:${escapeText(`${label}: ${event.title}`)}`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Google Calendar "add event" link — no sign-in prompt beyond Google's own. */
export function googleCalendarUrl(event: CalendarEvent, timeZone?: string): string {
  const start = event.allDay ? stampDate(event.start) : stampLocal(event.start);
  const end = event.allDay ? stampDate(event.end) : stampLocal(event.end);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start ?? ""}/${end ?? ""}`,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  if (timeZone && !event.allDay) params.set("ctz", timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Trigger a browser download of the .ics text. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A safe file name from a trip title. */
export function icsFileName(title: string): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "trip";
  return `adair-${slug}.ics`;
}
