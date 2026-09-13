/**
 * "Adair has noticed…" — what we learned from the traveller's own swaps,
 * shown in plain words, each line resettable. Anything they stated themselves
 * already wins over these, so nothing here contradicts their preferences.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getNoticed, resetNoticed } from "@/lib/account.functions";

export function Noticed() {
  const fetchNoticed = useServerFn(getNoticed);
  const forget = useServerFn(resetNoticed);
  const queryClient = useQueryClient();

  const noticed = useQuery({ queryKey: ["noticed"], queryFn: () => fetchNoticed() });
  const reset = useMutation({
    mutationFn: (subject: string) => forget({ data: { subject } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["noticed"] }),
  });

  const lines = noticed.data ?? [];
  if (!lines.length) return null;

  return (
    <section className="hairline-card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Adair has noticed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Learned from your swaps. Anything you have chosen yourself always comes first.
        </p>
      </div>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.subject}
            className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
          >
            <span>{line.sentence}</span>
            <button
              type="button"
              aria-label={`Forget: ${line.sentence}`}
              className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => reset.mutate(line.subject)}
              disabled={reset.isPending}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
