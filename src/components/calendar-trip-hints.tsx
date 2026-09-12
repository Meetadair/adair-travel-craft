/**
 * Trips spotted in a connected calendar. Always a suggestion — never an
 * automatic booking. Dismissing one stops it coming back.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, X } from "lucide-react";
import { dismissTripHint, listTripHints } from "@/lib/calendar.functions";

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function CalendarTripHints({ onPlan }: { onPlan: (sentence: string) => void }) {
  const fetchHints = useServerFn(listTripHints);
  const dismiss = useServerFn(dismissTripHint);
  const queryClient = useQueryClient();

  const hints = useQuery({
    queryKey: ["trip-hints"],
    queryFn: () => fetchHints(),
    retry: false,
  });

  const hide = useMutation({
    mutationFn: (id: string) => dismiss({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-hints"] }),
  });

  const rows = hints.data?.hints ?? [];
  if (!rows.length) return null;

  return (
    <div className="mt-6 space-y-3">
      {rows.map((hint) => (
        <div
          key={hint.id}
          className="hairline-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 gap-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed">
              You have “{hint.title}” in {hint.city},{" "}
              {hint.startsAt.slice(0, 10) === hint.endsAt.slice(0, 10)
                ? dayLabel(hint.startsAt)
                : `${dayLabel(hint.startsAt)}–${dayLabel(hint.endsAt)}`}
              . Shall I plan the trip?
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onPlan(hint.sentence)}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Plan it
            </button>
            <button
              type="button"
              aria-label="Not now"
              onClick={() => hide.mutate(hint.id)}
              disabled={hide.isPending}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm hover:bg-secondary disabled:opacity-60"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
