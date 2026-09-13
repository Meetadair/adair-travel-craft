import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { PickerKind, TripOverrides, Understanding } from "@/lib/trip/understanding";
import {
  AirportAnswer,
  DateAnswer,
  TimeAnswer,
  TravellersAnswer,
  type AnswerControlsCopy,
} from "./answer-controls";

export type StripCopy = {
  heading: string;
  wishes: string;
  edit: string;
  find: string;
  searching: string;
  done: string;
  airportSearch: string;
  travellersLabel: string;
  controls: AnswerControlsCopy;
};

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

function Picker({
  kind,
  value,
  copy,
  companions,
  onChange,
  onClose,
}: {
  kind: PickerKind;
  value: TripOverrides;
  copy: StripCopy;
  companions?: { id: string; label: string }[] | undefined;
  onChange: (next: TripOverrides) => void;
  onClose: () => void;
}) {
  const field =
    kind === "origin" ? "originIata" : kind === "destination" ? "destinationIata" : null;

  const done = (
    <button
      type="button"
      onClick={onClose}
      className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:border-primary/30"
    >
      {copy.done}
    </button>
  );

  if (field) {
    return (
      <div className="mt-2 w-[17rem] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-2">
        <AirportAnswer
          value={value[field] ?? null}
          copy={copy.controls}
          onChange={(iata) => {
            onChange({ ...value, [field]: iata });
            onClose();
          }}
        />
      </div>
    );
  }

  if (kind === "travellers") {
    return (
      <div className="mt-2 w-[17rem] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-3">
        <TravellersAnswer
          value={value.passengers ?? 1}
          companions={companions ?? []}
          copy={copy.controls}
          onChange={(count) => onChange({ ...value, passengers: count })}
        />
        {done}
      </div>
    );
  }

  if (kind === "arriveBy") {
    return (
      <div className="mt-2 w-[17rem] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-3">
        <TimeAnswer
          value={value.mustArriveBy ?? null}
          copy={copy.controls}
          onChange={(time) => onChange({ ...value, mustArriveBy: time })}
        />
        {done}
      </div>
    );
  }

  // Both date chips open the same calendar, so the outbound and the return are
  // chosen together in one place.
  return (
    <div className="mt-2 w-[20rem] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-3">
      <DateAnswer
        value={value.departDate ? { departDate: value.departDate, returnDate: value.returnDate ?? undefined } : null}
        copy={copy.controls}
        onChange={(range) =>
          onChange({
            ...value,
            departDate: range.departDate,
            ...(range.returnDate ? { returnDate: range.returnDate } : {}),
          })
        }
      />
      {done}
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
  companions,
  busy = false,
  canSearch = true,
  onChange,
  onFind,
}: {
  understanding: Understanding;
  overrides: TripOverrides;
  copy: StripCopy;
  companions?: { id: string; label: string }[] | undefined;
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
                companions={companions}
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
