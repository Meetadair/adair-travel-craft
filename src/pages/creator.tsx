/** The creator's own page: link, real counts, earnings, statement, submissions. */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import {
  getCreatorDashboard,
  listGetawayDestinationsForCreators,
  submitCreatorPlace,
} from "@/lib/creators.functions";
import { eur } from "@/lib/trip/client";

const money = (minor: number) => eur(minor / 100);

export function CreatorPage() {
  const fetchDashboard = useServerFn(getCreatorDashboard);
  const fetchDestinations = useServerFn(listGetawayDestinationsForCreators);
  const submitPlace = useServerFn(submitCreatorPlace);

  const dashboard = useQuery({ queryKey: ["creator-dashboard"], queryFn: () => fetchDashboard({}) });
  const destinations = useQuery({
    queryKey: ["creator-destinations"],
    queryFn: () => fetchDestinations({}),
    enabled: dashboard.data?.creator.status === "approved",
  });

  const [copied, setCopied] = useState(false);
  const [place, setPlace] = useState({
    destinationId: "",
    kind: "hotel" as "hotel" | "restaurant" | "sight",
    name: "",
    whyThisOne: "",
    visitedOn: "",
    postUrl: "",
    photos: "",
  });

  const send = useMutation({
    mutationFn: () =>
      submitPlace({
        data: {
          destinationId: place.destinationId,
          kind: place.kind,
          name: place.name,
          whyThisOne: place.whyThisOne,
          visitedOn: place.visitedOn || undefined,
          postUrl: place.postUrl || undefined,
          photos: place.photos
            .split(/\s+/)
            .map((v) => v.trim())
            .filter(Boolean)
            .slice(0, 3),
          acceptLicence: true,
        },
      }),
    onSuccess: () => {
      setPlace((prev) => ({ ...prev, name: "", whyThisOne: "", postUrl: "", photos: "" }));
      void dashboard.refetch();
    },
  });

  const data = dashboard.data;
  const link = data ? `${window.location.origin}/c/${data.creator.handle}` : "";
  const field =
    "mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

  function downloadStatement() {
    if (!data) return;
    const rows = [
      ["date", "type", "basis", "status", "amount_eur"],
      ...data.earnings.map((row) => [
        row.createdAt.slice(0, 10),
        row.lineType ?? "",
        row.basis,
        row.status,
        (row.amountMinor / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `adair-creator-statement-${data.creator.handle}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Creator</h1>

        {dashboard.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

        {dashboard.isSuccess && !data && (
          <div className="hairline-card mt-8 p-5">
            <p className="text-sm">You are not in the creator programme yet.</p>
            <Link
              to="/creators/apply"
              className="mt-3 inline-block text-sm font-medium text-primary"
            >
              Apply
            </Link>
          </div>
        )}

        {data && (
          <>
            {data.creator.status !== "approved" && (
              <p className="hairline-card mt-6 p-4 text-sm">
                Your account is <span className="font-medium">{data.creator.status}</span>. Your link
                starts attributing once it is approved.
              </p>
            )}

            <section className="hairline-card mt-8 p-5">
              <h2 className="text-sm font-medium">Your link and code</h2>
              <p className="mt-2 break-all font-mono text-sm">{link}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Code: <span className="font-mono">{data.creator.shortCode}</span>
              </p>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                A visitor stays attributed to you for 90 days, and you earn on their bookings for 12
                months from then.
              </p>
            </section>

            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Clicks", String(data.clicks)],
                ["Sign-ups", String(data.signups)],
                ["Bookings", String(data.bookings)],
                ["Payable now", money(data.balanceMinor)],
              ].map(([label, value]) => (
                <div key={label} className="hairline-card p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </section>

            <p className="mt-3 text-xs text-muted-foreground">
              {money(data.pendingMinor)} is still pending until the free-cancellation window passes.
              Payouts are monthly, from {money(data.payoutMinimumMinor)}.
              {data.readyForPayout ? " Your balance is ready." : " Below that it rolls over."}
            </p>

            <section className="hairline-card mt-8 divide-y divide-border">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-sm font-medium">Earnings by month</h2>
                <button onClick={downloadStatement} className="text-sm font-medium text-primary">
                  Download statement
                </button>
              </div>
              {data.months.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">Nothing earned yet.</p>
              )}
              {data.months.map((month) => (
                <div key={month.month} className="flex flex-wrap gap-x-6 gap-y-1 p-4 text-sm">
                  <span className="font-medium">{month.month}</span>
                  <span className="text-muted-foreground">
                    pending {money(month.pendingMinor)}
                  </span>
                  <span className="text-muted-foreground">
                    confirmed {money(month.confirmedMinor)}
                  </span>
                  <span className="text-muted-foreground">paid {money(month.paidMinor)}</span>
                  {month.reversedMinor > 0 && (
                    <span className="text-muted-foreground">
                      reversed {money(month.reversedMinor)}
                    </span>
                  )}
                </div>
              ))}
            </section>

            {data.payouts.length > 0 && (
              <section className="hairline-card mt-6 divide-y divide-border">
                <h2 className="p-4 text-sm font-medium">Payouts</h2>
                {data.payouts.map((payout) => (
                  <div key={payout.id} className="flex flex-wrap gap-x-6 p-4 text-sm">
                    <span>{payout.periodMonth.slice(0, 7)}</span>
                    <span>{money(payout.amountMinor)}</span>
                    <span className="text-muted-foreground">{payout.status}</span>
                    {payout.reference && (
                      <span className="text-muted-foreground">{payout.reference}</span>
                    )}
                  </div>
                ))}
              </section>
            )}

            {data.creator.status === "approved" && (
              <section className="hairline-card mt-8 p-5">
                <h2 className="text-sm font-medium">Recommend a place</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nothing appears until our editorial team approves it, and everything you recommend
                  carries a plain “Creator partner” label.
                </p>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send.mutate();
                  }}
                >
                  <label className="block text-sm">
                    Destination
                    <select
                      required
                      value={place.destinationId}
                      onChange={(e) => setPlace((p) => ({ ...p, destinationId: e.target.value }))}
                      className={field}
                    >
                      <option value="">Choose…</option>
                      {(destinations.data ?? []).map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.name}
                          {destination.country ? `, ${destination.country}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    What is it
                    <select
                      value={place.kind}
                      onChange={(e) =>
                        setPlace((p) => ({ ...p, kind: e.target.value as typeof p.kind }))
                      }
                      className={field}
                    >
                      <option value="hotel">Hotel</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="sight">Sight</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Name
                    <input
                      required
                      value={place.name}
                      onChange={(e) => setPlace((p) => ({ ...p, name: e.target.value }))}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm">
                    Why you recommend it
                    <textarea
                      required
                      rows={3}
                      value={place.whyThisOne}
                      onChange={(e) => setPlace((p) => ({ ...p, whyThisOne: e.target.value }))}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm">
                    When you stayed or ate there
                    <input
                      type="date"
                      value={place.visitedOn}
                      onChange={(e) => setPlace((p) => ({ ...p, visitedOn: e.target.value }))}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm">
                    Link to your post
                    <input
                      type="url"
                      value={place.postUrl}
                      onChange={(e) => setPlace((p) => ({ ...p, postUrl: e.target.value }))}
                      className={field}
                    />
                  </label>
                  <label className="block text-sm">
                    Up to 3 of your own photo links
                    <textarea
                      rows={2}
                      value={place.photos}
                      onChange={(e) => setPlace((p) => ({ ...p, photos: e.target.value }))}
                      className={field}
                      placeholder="One URL per line"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={send.isPending}
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {send.isPending ? "Sending…" : "Submit for review"}
                  </button>
                  {send.isSuccess && (
                    <p className="text-sm text-muted-foreground">Sent for review.</p>
                  )}
                  {send.isError && (
                    <p className="text-sm text-primary">That did not go through. Try again.</p>
                  )}
                </form>
              </section>
            )}

            {data.submissions.length > 0 && (
              <section className="hairline-card mt-6 divide-y divide-border">
                <h2 className="p-4 text-sm font-medium">Your submissions</h2>
                {data.submissions.map((row) => (
                  <div key={row.id} className="p-4 text-sm">
                    <p className="font-medium">
                      {row.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.kind}
                        {row.destination ? ` · ${row.destination}` : ""}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.reviewStatus}
                      {row.reviewNote ? ` — ${row.reviewNote}` : ""}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
