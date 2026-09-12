/** Download everything we hold, or close the account. */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { deleteMyAccount, exportMyData } from "@/lib/gdpr.functions";
import { supabase } from "@/integrations/supabase/client";

export function MyData() {
  const runExport = useServerFn(exportMyData);
  const runDelete = useServerFn(deleteMyAccount);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const download = useMutation({
    mutationFn: () => runExport({}),
    onSuccess: (result) => {
      setSummary(result.summary);
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `adair-my-data-${result.generatedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });

  const close = useMutation({
    mutationFn: () => runDelete({}),
    onSuccess: async () => {
      await supabase.auth.signOut();
      window.location.href = "/";
    },
  });

  return (
    <section className="hairline-card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You can take a copy of everything we hold at any time, or close your account.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => download.mutate()}
          disabled={download.isPending}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          <Download className="size-4" />
          {download.isPending ? "Preparing…" : "Download my data"}
        </button>
        {download.isError && (
          <p className="text-sm text-primary">We could not prepare the file. Please try again.</p>
        )}
        {summary && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-primary hover:bg-secondary"
          >
            <Trash2 className="size-4" /> Delete my account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              This removes your name, preferences, saved cards and calendar connections, and signs
              you out for good.
            </p>
            <p className="text-sm text-muted-foreground">
              Trips you have already booked stay with the travel supplier — cancel those first if
              you no longer want them. Invoices and payment records are kept without your name,
              because the law requires us to keep them.
            </p>
            <label className="block text-xs text-muted-foreground" htmlFor="confirm-delete">
              Type DELETE to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => close.mutate()}
                disabled={confirmText.trim().toUpperCase() !== "DELETE" || close.isPending}
                className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {close.isPending ? "Closing…" : "Delete for good"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                className="min-h-12 rounded-xl border border-border px-4 py-3 text-sm"
              >
                Keep my account
              </button>
            </div>
            {close.isError && (
              <p className="text-sm text-primary">We could not do that. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
