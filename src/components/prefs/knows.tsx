/**
 * "What Adair knows about you" — habits worked out from real bookings, and the
 * places they keep going back to. Each line can be removed on its own, and
 * everything learned can be cleared in one go. Stated preferences are never
 * touched by any of it.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  answerPattern,
  forgetEverythingLearned,
  forgetMemoryLine,
  getMyMemory,
} from "@/lib/memory.functions";
import { useT } from "@/lib/i18n";

export function Knows() {
  const t = useT();
  const copy = t.assistant.memory;
  const fetchMemory = useServerFn(getMyMemory);
  const answer = useServerFn(answerPattern);
  const forgetLine = useServerFn(forgetMemoryLine);
  const forgetAll = useServerFn(forgetEverythingLearned);
  const queryClient = useQueryClient();

  const memory = useQuery({ queryKey: ["my-memory"], queryFn: () => fetchMemory() });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["my-memory"] });

  const reply = useMutation({
    mutationFn: (input: { patternKind: string; value: string; accept: boolean }) =>
      answer({ data: input }),
    onSuccess: refresh,
  });
  const drop = useMutation({
    mutationFn: (id: string) => forgetLine({ data: { id } }),
    onSuccess: refresh,
  });
  const clear = useMutation({ mutationFn: () => forgetAll(), onSuccess: refresh });

  const data = memory.data;
  const lines = data?.lines ?? [];
  if (!data || (!lines.length && !data.ask)) return null;

  const group = (name: "pattern" | "place" | "ranking") =>
    lines.filter((line) => line.group === name);

  const block = (title: string, items: typeof lines) =>
    items.length ? (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-2">
          {items.map((line) => (
            <li
              key={line.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <span>{line.text}</span>
              <button
                type="button"
                aria-label={`Forget: ${line.text}`}
                className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => drop.mutate(line.id)}
                disabled={drop.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <section className="hairline-card space-y-5 p-5 sm:p-6" data-testid="knows">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          What Adair knows about you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Worked out from your own bookings — separate from the preferences you set above.
        </p>
      </div>

      {data.ask ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            {copy.askPattern.replace("{habit}", data.ask.question.split(" — ")[0] ?? "")}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
              onClick={() =>
                reply.mutate({
                  patternKind: data.ask!.patternKind,
                  value: data.ask!.value,
                  accept: true,
                })
              }
              disabled={reply.isPending}
            >
              {copy.askYes}
            </button>
            <button
              type="button"
              className="rounded-full border border-border px-4 py-1.5 text-xs"
              onClick={() =>
                reply.mutate({
                  patternKind: data.ask!.patternKind,
                  value: data.ask!.value,
                  accept: false,
                })
              }
              disabled={reply.isPending}
            >
              {copy.askNo}
            </button>
          </div>
        </div>
      ) : null}

      {block("Habits I confirmed with you", group("pattern"))}
      {block("Places you go back to", group("place"))}
      {block("How I rank things for you", group("ranking"))}

      <button
        type="button"
        className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        onClick={() => clear.mutate()}
        disabled={clear.isPending}
      >
        Forget everything you&apos;ve learned
      </button>
    </section>
  );
}
