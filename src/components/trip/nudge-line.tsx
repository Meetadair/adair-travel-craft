import { Link } from "@tanstack/react-router";
import type { Nudge } from "@/lib/trip/nudges";

/** One quiet suggestion for next time; gone for good once dismissed. */
export function NudgeLine({
  nudge,
  dismissLabel,
  onDismiss,
}: {
  nudge: Nudge;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div
      data-testid="nudge-line"
      className="mt-3 flex flex-col gap-2 rounded-xl border border-border px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs leading-relaxed text-muted-foreground">{nudge.text}</p>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          to={nudge.href}
          className="text-xs font-medium text-primary underline decoration-primary/30 underline-offset-4"
        >
          {nudge.actionLabel}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
