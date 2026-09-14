/** Invite friends and see the travel-credit balance and history. */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, Gift } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getMyReferral } from "@/lib/referrals.functions";
import { eur } from "@/lib/trip/client";
import { AppFooter } from "@/components/app-footer";

export function CreditPage() {
  const fetchReferral = useServerFn(getMyReferral);
  const summary = useQuery({ queryKey: ["my-referral"], queryFn: () => fetchReferral({}) });
  const [copied, setCopied] = useState(false);

  const data = summary.data;
  const link = data ? `${window.location.origin}/r/${data.code}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Credit &amp; invites</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Travel credit comes off your next trip total. It is an Adair voucher, not money we hold,
          and it is never paid out in cash.
        </p>

        {summary.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {summary.isError && (
          <p className="mt-8 text-sm text-muted-foreground">
            We couldn't load your credit just now. Please try again in a moment.
          </p>
        )}

        {data && (
          <>
            <section className="mt-8 rounded-xl border border-border p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
              <p className="mt-1 font-display text-3xl font-semibold">
                {eur(data.balanceMinor / 100)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Applied automatically to your next booking.
              </p>
            </section>

            <section className="mt-6 rounded-xl border border-border p-5">
              <div className="flex items-start gap-3">
                <Gift className="mt-0.5 size-4 text-primary" />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold">Invite a traveller</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    They receive {eur(data.friendRewardMinor / 100)}, you receive{" "}
                    {eur(data.referrerRewardMinor / 100)} — both when their first trip is booked.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 truncate rounded-lg border border-border bg-secondary px-3 py-2 text-xs">
                  {link}
                </code>
                <button
                  onClick={() => void copy()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {data.invited} invited · {data.booked} booked their first trip
              </p>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-lg font-semibold">History</h2>
              {data.entries.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No credit yet. Invite a traveller to get started.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                  {data.entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-baseline justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 text-sm">
                        {entry.reason}
                        <span className="block text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toISOString().slice(0, 10)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium">
                        {entry.kind === "spend" ? "−" : "+"}
                        {eur(Math.abs(entry.amountMinor) / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
