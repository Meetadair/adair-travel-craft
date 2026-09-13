import type { AdviceLine } from "@/lib/trip/advice";

/**
 * What Adair noticed about this proposal — at most two lines, above the card,
 * each with the one action that follows from it.
 */
export function AdviceLines({
  lines,
  onAct,
}: {
  lines: AdviceLine[];
  onAct: (line: AdviceLine) => void;
}) {
  if (!lines.length) return null;
  return (
    <div data-testid="advice-lines" className="mb-3 space-y-2">
      {lines.map((line) => (
        <div
          key={line.kind}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm leading-relaxed text-foreground">{line.text}</p>
          {line.action && (
            <button
              type="button"
              onClick={() => onAct(line)}
              className="shrink-0 self-start rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5 sm:self-auto"
            >
              {line.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
