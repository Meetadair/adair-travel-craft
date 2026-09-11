import { useState } from "react";
import { CalendarPlus, ChevronDown, ExternalLink } from "lucide-react";
import {
  buildIcs,
  downloadIcs,
  googleCalendarUrl,
  icsFileName,
  type CalendarEvent,
} from "@/lib/calendar";

/**
 * "Add to calendar" pair: a downloadable .ics (Apple / Outlook) and per-event
 * Google Calendar links. No account connection, no OAuth.
 */
export function AddToCalendar({
  events,
  title,
  className = "",
}: {
  events: CalendarEvent[];
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (events.length === 0) return null;
  const timeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return (
    <div className={`relative flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => downloadIcs(icsFileName(title), buildIcs(events, title))}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
      >
        <CalendarPlus className="size-3.5" />
        Add to calendar
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
      >
        Add to Google Calendar
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul className="absolute left-0 top-full z-20 mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {events.map((event) => (
            <li key={event.uid} className="border-b border-border last:border-0">
              <a
                href={googleCalendarUrl(event, timeZone)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-secondary"
              >
                <span className="min-w-0 truncate">{event.title}</span>
                <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
