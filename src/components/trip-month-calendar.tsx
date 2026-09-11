import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TripMark = {
  id: string;
  city: string | null;
  title: string;
  startDate: string | null;
  endDate: string | null;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function key(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Month grid of the traveller's own trips: a dot on each start / end day. */
export function TripMonthCalendar({ trips }: { trips: TripMark[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const marks = useMemo(() => {
    const map = new Map<string, Array<{ label: string; kind: "start" | "end" }>>();
    for (const trip of trips) {
      const label = trip.city ?? trip.title;
      for (const [date, kind] of [
        [trip.startDate, "start"],
        [trip.endDate, "end"],
      ] as const) {
        if (!date) continue;
        const day = date.slice(0, 10);
        const list = map.get(day) ?? [];
        list.push({ label, kind });
        map.set(day, list);
      }
    }
    return map;
  }, [trips]);

  const first = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const cells: Array<number | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div className="hairline-card p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Previous month"
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="font-display text-base font-semibold">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Next month"
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <span key={`pad-${index}`} className="aspect-square" />;
          const dayKey = key(cursor.year, cursor.month, day);
          const dayMarks = marks.get(dayKey) ?? [];
          const isToday =
            today.getFullYear() === cursor.year &&
            today.getMonth() === cursor.month &&
            today.getDate() === day;
          return (
            <div
              key={dayKey}
              title={dayMarks.map((m) => `${m.label} · ${m.kind}`).join(", ") || undefined}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-xs ${
                dayMarks.length ? "border-primary/40 bg-primary/5" : "border-border/60"
              } ${isToday ? "font-semibold" : ""}`}
            >
              <span>{day}</span>
              {dayMarks.length > 0 && (
                <>
                  <span className="mt-1 size-1.5 rounded-full bg-primary" aria-hidden />
                  <span className="sr-only">{dayMarks.map((m) => m.label).join(", ")}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {marks.size > 0 && (
        <ul className="mt-5 space-y-1 text-xs text-muted-foreground sm:hidden">
          {Array.from(marks.entries())
            .filter(([day]) => day.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, list]) => (
              <li key={day}>
                {day.slice(8)} · {list.map((m) => m.label).join(", ")}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
