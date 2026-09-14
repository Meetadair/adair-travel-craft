import { Suspense, lazy, useState } from "react";

// The month grid is only needed once a date question is on screen, so it loads
// on demand and keeps the first chat render light.
const Calendar = lazy(async () => ({
  default: (await import("@/components/ui/calendar")).Calendar,
}));
import {
  TIME_SHORTCUTS,
  addDaysIso,
  dateShortcuts,
  isCompleteRange,
  monthRange,
  nightsBetween,
  searchAirports,
  today,
  type DateRange,
  type DateShortcutId,
} from "@/lib/trip/answers";

export type AnswerControlsCopy = {
  thisWeekend: string;
  nextWeekend: string;
  tomorrow: string;
  outbound: string;
  returnDay: string;
  oneWay: string;
  pickReturn: string;
  nightsLabel: string;
  nightsWord: string;
  airportSearch: string;
  airportEmpty: string;
  timeLabel: string;
  travellersLabel: string;
  companionsHint: string;
  done: string;
};

const CHIP =
  "rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40";
const CHIP_ON = "rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs text-foreground";

const isoOf = (date: Date): string =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const dateOf = (value: string | undefined): Date | undefined =>
  value ? new Date(`${value}T00:00:00`) : undefined;

const SHORTCUT_LABEL: Record<DateShortcutId, keyof AnswerControlsCopy> = {
  this_weekend: "thisWeekend",
  next_weekend: "nextWeekend",
  tomorrow: "tomorrow",
};

/**
 * The date answer: three shortcut chips over a compact month calendar. A range
 * is picked by tapping the outbound day and then the return; one tap alone is a
 * single-day trip. Past days are never selectable and the month opens on today.
 */
export function DateAnswer({
  value,
  copy,
  onChange,
}: {
  value: DateRange | null;
  copy: AnswerControlsCopy;
  onChange: (range: DateRange) => void;
}) {
  const from = today();
  const bounds = monthRange(from);
  const shortcuts = dateShortcuts(from);
  const selected = value
    ? { from: dateOf(value.departDate), to: dateOf(value.returnDate ?? value.departDate) }
    : undefined;

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => {
          const active =
            value?.departDate === shortcut.range.departDate &&
            (value?.returnDate ?? null) === (shortcut.range.returnDate ?? null);
          return (
            <button
              key={shortcut.id}
              type="button"
              onClick={() => onChange(shortcut.range)}
              className={active ? CHIP_ON : CHIP}
            >
              {copy[SHORTCUT_LABEL[shortcut.id]]}
            </button>
          );
        })}
      </div>

      <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-border bg-background">
        <Suspense fallback={<div className="h-64" aria-hidden />}>
          <Calendar
            mode="range"
            selected={selected as never}
            defaultMonth={dateOf(value?.departDate) ?? new Date(`${from}T00:00:00`)}
            startMonth={new Date(`${bounds.start}T00:00:00`)}
            endMonth={new Date(`${bounds.end}T00:00:00`)}
            disabled={{ before: new Date(`${from}T00:00:00`) }}
            onSelect={
              ((range: { from?: Date | undefined; to?: Date | undefined } | undefined) => {
                if (!range?.from) return;
                onChange({
                  departDate: isoOf(range.from),
                  returnDate: range.to ? isoOf(range.to) : undefined,
                });
              }) as never
            }
            className="pointer-events-auto w-full p-2 [--cell-size:2rem] sm:[--cell-size:2.25rem]"
          />
        </Suspense>
      </div>

      {value?.departDate && !value.returnDate && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{copy.nightsLabel}</span>
          {[1, 2, 3, 5, 7].map((nights) => (
            <button
              key={nights}
              type="button"
              onClick={() =>
                onChange({
                  departDate: value.departDate,
                  returnDate: addDaysIso(value.departDate, nights),
                })
              }
              className={CHIP}
            >
              {nights}
            </button>
          ))}
        </div>
      )}

      <p
        className={
          value && !isCompleteRange(value)
            ? "mt-2 text-[11px] text-primary"
            : "mt-2 text-[11px] text-muted-foreground"
        }
      >
        {!value
          ? copy.outbound
          : isCompleteRange(value)
            ? `${copy.outbound} ${value.departDate} · ${copy.returnDay} ${value.returnDate} · ${nightsBetween(value.departDate, value.returnDate ?? value.departDate)} ${copy.nightsWord}`
            : copy.pickReturn}
      </p>
    </div>
  );
}

/** The arrival-time answer: common times as chips, then a real time picker. */
export function TimeAnswer({
  value,
  copy,
  onChange,
}: {
  value: string | null;
  copy: AnswerControlsCopy;
  onChange: (time: string) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        {TIME_SHORTCUTS.map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => onChange(time)}
            className={value === time ? CHIP_ON : CHIP}
          >
            {time}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[11px] text-muted-foreground">
        {copy.timeLabel}
        <input
          type="time"
          value={value ?? ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="mt-1 block w-full max-w-[10rem] rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
        />
      </label>
    </div>
  );
}

/**
 * The airport answer: the airports Adair already knows about as chips, then a
 * searchable list of every airport it can fly from.
 */
export function AirportAnswer({
  value,
  suggestions = [],
  copy,
  onChange,
}: {
  value: string | null;
  suggestions?: { iata: string; label: string }[];
  copy: AnswerControlsCopy;
  onChange: (iata: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = searchAirports(query);

  return (
    <div className="w-full">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((option) => (
            <button
              key={option.iata}
              type="button"
              onClick={() => onChange(option.iata)}
              className={value === option.iata ? CHIP_ON : CHIP}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={copy.airportSearch}
        aria-label={copy.airportSearch}
        className={`${suggestions.length > 0 ? "mt-3" : ""} w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none`}
      />
      <ul className="mt-1 max-h-44 overflow-auto rounded-lg border border-border">
        {matches.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">{copy.airportEmpty}</li>
        )}
        {matches.map((match) => (
          <li key={match.iata}>
            <button
              type="button"
              onClick={() => onChange(match.iata)}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-muted ${
                value === match.iata ? "font-semibold text-foreground" : "text-foreground"
              }`}
            >
              {match.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The travellers answer: 1–4 people as chips, then the saved "people I travel
 * with" list, so a companion is chosen by name rather than counted.
 */
export function TravellersAnswer({
  value,
  companions = [],
  selected = [],
  copy,
  onChange,
  onToggleCompanion,
}: {
  value: number;
  companions?: { id: string; label: string }[];
  selected?: string[];
  copy: AnswerControlsCopy;
  onChange: (count: number) => void;
  onToggleCompanion?: (id: string) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onChange(count)}
            className={value === count ? CHIP_ON : CHIP}
          >
            {count}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[11px] text-muted-foreground">
        {copy.travellersLabel}
        <input
          type="number"
          min={1}
          max={9}
          value={value}
          onChange={(e) => onChange(Math.min(9, Math.max(1, Number(e.target.value) || 1)))}
          className="mt-1 block w-full max-w-[6rem] rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
        />
      </label>
      {companions.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">{copy.companionsHint}</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {companions.map((companion) => (
              <li key={companion.id}>
                <button
                  type="button"
                  onClick={() => onToggleCompanion?.(companion.id)}
                  className={selected.includes(companion.id) ? CHIP_ON : CHIP}
                >
                  {companion.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
