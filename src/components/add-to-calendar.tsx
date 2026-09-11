import { CalendarPlus, ExternalLink } from "lucide-react";
import {
  buildIcs,
  downloadIcs,
  googleCalendarUrl,
  icsFileName,
  type CalendarEvent,
} from "@/lib/calendar";

/**
 * "Add to calendar" pair: a downloadable .ics (Apple / Outlook) and a
 * URL-based Google Calendar link. No account connection, no OAuth.
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
  const first = events[0];
  if (!first) return null;
  const timeZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => downloadIcs(icsFileName(title), buildIcs(events, title))}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary"
      >
        <CalendarPlus className="size-3.5" />
        Add to calendar
      </button>
      <a
        href={googleCalendarUrl(first, timeZone)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
      >
        Add to Google Calendar
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
