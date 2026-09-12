import { useState } from "react";
import type { LineMatch } from "@/lib/trip/match";

/** Dots plus the real checklist behind the score, expandable on tap. */
export function MatchNote({ match, label }: { match: LineMatch | null | undefined; label: string }) {
  const [open, setOpen] = useState(false);
  if (!match || match.total === 0) return null;
  const dots = Array.from({ length: match.total }, (_, i) => i < match.met);

  return (
    <div className="px-5 pb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden className="tracking-[0.15em] text-primary">
          {dots.map((on) => (on ? "\u25cf" : "\u25cb")).join("")}
        </span>
        <span>
          matches {match.met} of your {match.total} {label} criteria
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {match.criteria.map((criterion, index) => (
            <li key={index} className="flex gap-2 text-xs text-muted-foreground">
              <span aria-hidden className={criterion.ok ? "text-primary" : "text-muted-foreground"}>
                {criterion.ok ? "\u2713" : "\u2717"}
              </span>
              <span>{criterion.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const REASONS = [
  { id: "expensive", label: "Too expensive" },
  { id: "far", label: "Too far" },
  { id: "time", label: "Wrong time" },
  { id: "brand", label: "Wrong brand or chain" },
  { id: "other", label: "Just not this one" },
];

export type AltOption = { title: string; priceLabel: string };

/**
 * "Show other options" for one line: the alternatives we already have from the
 * same search, plus an optional one-tap reason. Swapping never waits on it.
 */
export function LineOptions({
  options,
  busy,
  onPick,
  emptyNote,
}: {
  options: AltOption[];
  busy?: boolean;
  onPick: (index: number, reason?: string) => void;
  /** Calm note shown when the supplier returned nothing else for this line. */
  emptyNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  if (!options.length) {
    if (!emptyNote) return null;
    return <p className="px-5 pb-4 text-xs text-muted-foreground">{emptyNote}</p>;
  }

  if (picked !== null) {
    return (
      <div className="px-5 pb-4">
        <p className="text-xs text-muted-foreground">Why not the one we suggested? (optional)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => {
                onPick(picked, reason.label);
                setPicked(null);
                setOpen(false);
              }}
              className="rounded-xl border border-border px-3 py-1.5 text-xs hover:border-primary"
            >
              {reason.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onPick(picked);
              setPicked(null);
              setOpen(false);
            }}
            className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground underline underline-offset-4"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-primary hover:border-primary sm:w-auto sm:justify-start"
      >
        <span>{open ? "Hide other options" : "Show other options"}</span>
        <span className="text-xs font-normal text-muted-foreground">
          {options.length} {options.length === 1 ? "option" : "options"}
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {options.map((option, index) => (
            <li key={`${option.title}-${index}`}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPicked(index)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-left text-sm hover:border-primary disabled:opacity-60"
              >
                <span className="min-w-0 truncate">{option.title}</span>
                <span className="shrink-0">{option.priceLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
