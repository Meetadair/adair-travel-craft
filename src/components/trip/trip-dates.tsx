import { useMemo, useState } from "react";

import { addDaysIso, nightsBetween, today, type DateRange } from "@/lib/trip/answers";

/**
 * Picking the days of a trip.
 *
 * Two months at once, because a trip almost never fits in the month you happen
 * to be looking at, and hunting month by month is the thing people hate about
 * booking forms. One way is a visible choice at the top rather than something
 * inferred from an unfinished answer.
 *
 * Deliberately not react-day-picker: its month grid is a table, and the cell
 * sizing fought our own styles badly enough to cut September off at the 12th.
 * Seven columns of buttons owe nothing to anyone.
 */

type Copy = {
  outbound: string;
  returnDay: string;
  oneWay: string;
  roundTrip: string;
  pickReturn: string;
  nightsWord: string;
};

const DAY_MS = 86_400_000;

const isoOf = (d: Date): string =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/** Days of one month, padded with blanks so the 1st lands under its weekday. */
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = first.getDay(); // 0 = Sunday, matching the header row
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d += 1) cells.push(isoOf(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthLabel(year: number, month: number, locale: string): string {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function weekdayNames(locale: string): string[] {
  // A known Sunday, walked forward, so the labels match the column order.
  const sunday = new Date(2026, 0, 4);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(sunday.getTime() + i * DAY_MS).toLocaleDateString(locale, { weekday: "narrow" }),
  );
}

function pretty(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// first-letter, not `capitalize`: "one way" must not become "One Way".
const SEG =
  "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors first-letter:uppercase";
const SEG_ON = `${SEG} bg-primary text-primary-foreground`;
const SEG_OFF = `${SEG} text-muted-foreground hover:text-foreground`;

export function TripDates({
  value,
  copy,
  locale = "en",
  monthsAhead = 12,
  onChange,
}: {
  value: DateRange | null;
  copy: Copy;
  locale?: string;
  monthsAhead?: number;
  onChange: (range: DateRange) => void;
}) {
  const from = today();
  const oneWay = Boolean(value?.oneWay);

  const start = useMemo(() => {
    const anchor = value?.departDate ?? from;
    const d = new Date(`${anchor}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [value?.departDate, from]);

  const [offset, setOffset] = useState(0);

  const limit = useMemo(() => {
    const d = new Date(`${from}T00:00:00`);
    d.setMonth(d.getMonth() + monthsAhead);
    return isoOf(d);
  }, [from, monthsAhead]);

  const shown = useMemo(() => {
    const base = new Date(start.year, start.month + offset, 1);
    return [0, 1].map((i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, [start, offset]);

  const weekdays = useMemo(() => weekdayNames(locale), [locale]);

  const canGoBack = (() => {
    const d = new Date(shown[0]!.year, shown[0]!.month, 1);
    const floor = new Date(`${from}T00:00:00`);
    return d > new Date(floor.getFullYear(), floor.getMonth(), 1);
  })();

  function pick(iso: string) {
    if (oneWay) {
      onChange({ departDate: iso, oneWay: true });
      return;
    }
    const depart = value?.departDate;
    // A second tap after the outbound closes the range; anything else starts over.
    if (depart && !value?.returnDate && iso >= depart) {
      onChange({ departDate: depart, returnDate: iso });
      return;
    }
    onChange({ departDate: iso });
  }

  function setMode(next: boolean) {
    const depart = value?.departDate;
    if (!depart) {
      onChange({ departDate: from, ...(next ? { oneWay: true } : {}) });
      return;
    }
    onChange(
      next
        ? { departDate: depart, oneWay: true }
        : { departDate: depart, returnDate: addDaysIso(depart, 2) },
    );
  }

  const depart = value?.departDate;
  const back = value?.oneWay ? undefined : value?.returnDate;
  const nights = depart && back ? nightsBetween(depart, back) : null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <div
        role="group"
        aria-label={copy.oneWay}
        className="mb-3 flex gap-1 rounded-xl bg-muted/60 p-1"
      >
        <button type="button" className={oneWay ? SEG_OFF : SEG_ON} onClick={() => setMode(false)}>
          {copy.roundTrip}
        </button>
        <button type="button" className={oneWay ? SEG_ON : SEG_OFF} onClick={() => setMode(true)}>
          {copy.oneWay}
        </button>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        {shown.map((m, index) => (
          <div
            key={`${m.year}-${m.month}`}
            className={index === 1 ? "hidden sm:block sm:flex-1" : "sm:flex-1"}
          >
            <div className="mb-2 flex items-center justify-between">
              {index === 0 ? (
                <button
                  type="button"
                  onClick={() => setOffset((o) => o - 1)}
                  disabled={!canGoBack}
                  aria-label="Previous month"
                  className="h-7 w-7 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  ‹
                </button>
              ) : (
                <span className="h-7 w-7" aria-hidden />
              )}
              <span className="text-sm font-medium text-foreground">
                {monthLabel(m.year, m.month, locale)}
              </span>
              {index === 1 ? (
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + 1)}
                  aria-label="Next month"
                  className="h-7 w-7 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  ›
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + 1)}
                  aria-label="Next month"
                  className="h-7 w-7 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:invisible"
                >
                  ›
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {weekdays.map((w, i) => (
                <div key={i} className="pb-1 text-center text-[0.7rem] text-muted-foreground">
                  {w}
                </div>
              ))}
              {monthCells(m.year, m.month).map((iso, i) => {
                if (!iso) return <div key={i} aria-hidden />;
                const past = iso < from || iso > limit;
                const isDepart = iso === depart;
                const isBack = Boolean(back) && iso === back;
                const middle = Boolean(depart && back && iso > depart && iso < back);
                const edge = isDepart || isBack;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={past}
                    onClick={() => pick(iso)}
                    aria-pressed={edge}
                    className={[
                      "relative h-9 text-sm transition-colors",
                      past ? "cursor-default text-muted-foreground/35" : "hover:bg-accent",
                      middle ? "bg-accent text-accent-foreground" : "",
                      edge ? "bg-primary font-semibold text-primary-foreground" : "",
                      isDepart && back ? "rounded-l-lg" : "",
                      isBack ? "rounded-r-lg" : "",
                      !edge && !middle ? "rounded-lg" : "",
                      edge && !back ? "rounded-lg" : "",
                    ].join(" ")}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-sm">
        <div>
          <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
            {copy.outbound}
          </div>
          <div className="text-foreground">{pretty(depart, locale)}</div>
        </div>
        {!oneWay && (
          <div>
            <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              {copy.returnDay}
            </div>
            <div className={back ? "text-foreground" : "text-muted-foreground"}>
              {back ? pretty(back, locale) : copy.pickReturn}
            </div>
          </div>
        )}
        {nights !== null && (
          <div className="text-muted-foreground">
            {nights} {copy.nightsWord}
          </div>
        )}
        {oneWay && <div className="text-muted-foreground">{copy.oneWay}</div>}
      </div>
    </div>
  );
}
