import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { AIRPORT_COORDS } from "@/lib/trip/airport-geo";
import type { PickerKind, TripOverrides, Understanding } from "@/lib/trip/understanding";

export type StripCopy = {
  heading: string;
  wishes: string;
  edit: string;
  find: string;
  searching: string;
  done: string;
  airportSearch: string;
  travellersLabel: string;
};

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

const AIRPORTS = Object.keys(AIRPORT_COORDS).sort();

function Picker({
  kind,
  value,
  copy,
  onChange,
  onClose,
}: {
  kind: PickerKind;
  value: TripOverrides;
  copy: StripCopy;
  onChange: (next: TripOverrides) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const field =
    kind === "origin" ? "originIata" : kind === "destination" ? "destinationIata" : null;

  if (field) {
    const matches = AIRPORTS.filter((code) => code.includes(query.toUpperCase())).slice(0, 8);
    return (
      <div className="mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-none">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.airportSearch}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
        />
        <ul className="mt-1 max-h-40 overflow-auto">
          {matches.map((code) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => {
                  onChange({ ...value, [field]: code });
                  onClose();
                }}
                className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
              >
                {code}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (kind === "travellers") {
    return (
      <div className="mt-2 w-44 rounded-xl border border-border bg-card p-2">
        <label className="block text-[11px] text-muted-foreground" htmlFor="strip-travellers">
          {copy.travellersLabel}
        </label>
        <input
          id="strip-travellers"
          autoFocus
          type="number"
          min={1}
          max={9}
          defaultValue={value.passengers ?? 1}
          onChange={(e) => onChange({ ...value, passengers: Number(e.target.value) || 1 })}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/30"
        >
          {copy.done}
        </button>
      </div>
    );
  }

  const inputType = kind === "arriveBy" ? "time" : "date";
  const current =
    kind === "arriveBy"
      ? value.mustArriveBy
      : kind === "departDate"
        ? value.departDate
        : value.returnDate;
  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-2">
      <input
        autoFocus
        type={inputType}
        defaultValue={current ?? ""}
        onChange={(e) => {
          const next = e.target.value;
          if (kind === "arriveBy") onChange({ ...value, mustArriveBy: next });
          else if (kind === "departDate") onChange({ ...value, departDate: next });
          else onChange({ ...value, returnDate: next });
        }}
        className="rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none"
      />
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/30"
      >
        {copy.done}
      </button>
    </div>
  );
}

/**
 * What Adair understood, shown before anything is searched. Every structured
 * element is tappable and opens the right picker; the search runs only when the
 * traveller taps "Find it".
 */
export function UnderstandingStrip({
  understanding,
  overrides,
  copy,
  busy = false,
  canSearch = true,
  onChange,
  onFind,
}: {
  understanding: Understanding;
  overrides: TripOverrides;
  copy: StripCopy;
  busy?: boolean;
  canSearch?: boolean;
  onChange: (next: TripOverrides) => void;
  onFind: () => void;
}) {
  const [open, setOpen] = useState<PickerKind | null>(null);

  return (
    <div
      data-testid="understanding-strip"
      className="mt-4 rounded-xl border border-border bg-card p-4 text-left"
    >
      <p className="text-xs text-muted-foreground">{copy.heading}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {understanding.fields.map((field) => (
          <li key={field.key}>
            <button
              type="button"
              aria-label={fill(copy.edit, { field: field.label })}
              onClick={() => setOpen((prev) => (prev === field.key ? null : field.key))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
            >
              <span className="text-muted-foreground">{field.label}</span>
              <span className="font-medium">{field.value}</span>
              <Pencil className="size-3 text-muted-foreground" />
            </button>
            {open === field.key && (
              <Picker
                kind={field.key}
                value={overrides}
                copy={copy}
                onChange={onChange}
                onClose={() => setOpen(null)}
              />
            )}
          </li>
        ))}
      </ul>

      {understanding.wishes.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">{copy.wishes}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {understanding.wishes.map((wish) => (
              <li
                key={wish}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <Check className="size-3 text-primary" />
                {wish}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onFind}
        disabled={busy || !canSearch}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? copy.searching : copy.find}
      </button>
    </div>
  );
}
