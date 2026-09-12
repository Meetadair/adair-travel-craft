/** Admin: approve creators, edit commission, review submitted places, mark payouts paid. */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import {
  createCreatorPayout,
  getCreatorAdminOverview,
  markCreatorPayoutPaid,
  reviewCreatorPlace,
  saveCreatorCommissionRule,
  setCreatorStatus,
} from "@/lib/admin-creators.functions";
import { eur } from "@/lib/trip/client";

const money = (minor: number) => eur(minor / 100);

export function AdminCreatorsPage() {
  const fetchOverview = useServerFn(getCreatorAdminOverview);
  const setStatus = useServerFn(setCreatorStatus);
  const saveRule = useServerFn(saveCreatorCommissionRule);
  const review = useServerFn(reviewCreatorPlace);
  const drawPayout = useServerFn(createCreatorPayout);
  const markPaid = useServerFn(markCreatorPayoutPaid);
  const queryClient = useQueryClient();

  const overview = useQuery({ queryKey: ["admin-creators"], queryFn: () => fetchOverview({}) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-creators"] });

  const status = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "paused" | "rejected"; note: string }) =>
      setStatus({
        data: { id: input.id, status: input.status, note: input.note || null },
      }),
    onSuccess: refresh,
  });
  const rule = useMutation({
    mutationFn: (input: {
      id: string;
      shareBps: number;
      flatMinor: number;
      earningWindowMonths: number;
      active: boolean;
    }) => saveRule({ data: input }),
    onSuccess: refresh,
  });
  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected"; note: string }) =>
      review({
        data: {
          id: input.id,
          decision: input.decision,
          editorialNote: null,
          reviewNote: input.note || null,
        },
      }),
    onSuccess: refresh,
  });
  const payout = useMutation({
    mutationFn: (creatorId: string) => drawPayout({ data: { creatorId } }),
    onSuccess: refresh,
  });
  const paid = useMutation({
    mutationFn: (input: { id: string; reference: string }) => markPaid({ data: input }),
    onSuccess: refresh,
  });

  const [notes, setNotes] = useState<Record<string, string>>({});
  const data = overview.data;
  const field = "rounded-lg border border-border bg-card px-2 py-1 text-sm";

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Creators</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Commission is a share of our margin, paid only on confirmed bookings. Placement is never
          for sale.
        </p>

        {overview.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {overview.isError && (
          <p className="mt-8 flex items-center gap-2 text-sm text-primary">
            <ShieldAlert className="size-4" /> Admins only.
          </p>
        )}

        {data && (
          <div className="mt-8 space-y-10">
            <section>
              <h2 className="text-sm font-medium">Applications and accounts</h2>
              <div className="hairline-card mt-3 divide-y divide-border">
                {data.creators.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Nobody has applied yet.</p>
                )}
                {data.creators.map((creator) => (
                  <div key={creator.id} className="p-4">
                    <p className="font-medium">
                      {creator.displayName}
                      <span className="ml-2 text-xs text-muted-foreground">
                        /c/{creator.handle} · {creator.shortCode} · {creator.status}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {creator.clicks} clicks · {creator.signups} sign-ups · confirmed{" "}
                      {money(creator.confirmedMinor)} · pending {money(creator.pendingMinor)} ·
                      payable {money(creator.payableMinor)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Payout: {creator.payoutEntity ?? "no entity"} ·{" "}
                      {creator.payoutIbanLast4 ? `IBAN ••••${creator.payoutIbanLast4}` : "no IBAN"} ·{" "}
                      {creator.payoutVatStatus ?? "VAT status unknown"}
                    </p>
                    {creator.platforms.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {creator.platforms.map((platform) => (
                          <li key={platform.url}>
                            <a
                              href={platform.url}
                              target="_blank"
                              rel="noreferrer nofollow"
                              className="text-xs text-primary"
                            >
                              {platform.network}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        placeholder="Note (optional)"
                        value={notes[creator.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [creator.id]: e.target.value }))
                        }
                        className={field}
                      />
                      {(["approved", "paused", "rejected"] as const).map((next) => (
                        <button
                          key={next}
                          onClick={() =>
                            status.mutate({
                              id: creator.id,
                              status: next,
                              note: notes[creator.id] ?? "",
                            })
                          }
                          className="rounded-lg border border-border px-3 py-1 text-xs capitalize"
                        >
                          {next}
                        </button>
                      ))}
                      <button
                        onClick={() => payout.mutate(creator.id)}
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Draw payout
                      </button>
                    </div>
                    {payout.isSuccess && payout.data?.created === false && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Nothing drawn — balance is below {money(data.payoutMinimumMinor)}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium">Commission</h2>
              <div className="hairline-card mt-3 divide-y divide-border">
                {data.rules.map((row) => (
                  <form
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 p-4 text-sm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      rule.mutate({
                        id: row.id,
                        shareBps: Number(form.get("share")),
                        flatMinor: Number(form.get("flat")),
                        earningWindowMonths: Number(form.get("months")),
                        active: form.get("active") === "on",
                      });
                    }}
                  >
                    <span className="min-w-40 font-medium">
                      {row.kind === "line" ? row.lineType : `${row.plan} signup`}
                    </span>
                    <label className="text-xs text-muted-foreground">
                      share of our margin (bps)
                      <input
                        name="share"
                        type="number"
                        defaultValue={row.shareBps}
                        className={`ml-2 w-24 ${field}`}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      flat (cents)
                      <input
                        name="flat"
                        type="number"
                        defaultValue={row.flatMinor}
                        className={`ml-2 w-24 ${field}`}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      months
                      <input
                        name="months"
                        type="number"
                        defaultValue={row.earningWindowMonths}
                        className={`ml-2 w-16 ${field}`}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      <input name="active" type="checkbox" defaultChecked={row.active} /> active
                    </label>
                    <button className="rounded-lg border border-border px-3 py-1 text-xs">
                      Save
                    </button>
                  </form>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium">Submitted places</h2>
              <div className="hairline-card mt-3 divide-y divide-border">
                {data.submissions.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No submissions.</p>
                )}
                {data.submissions.map((place) => (
                  <div key={place.id} className="p-4 text-sm">
                    <p className="font-medium">
                      {place.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {place.kind}
                        {place.destination ? ` · ${place.destination}` : ""} · {place.reviewStatus}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {place.creatorName ?? "unknown"}
                      {place.creatorHandle ? ` (/c/${place.creatorHandle})` : ""}
                      {place.visitedOn ? ` · visited ${place.visitedOn}` : ""}
                    </p>
                    {place.whyThisOne && <p className="mt-2">{place.whyThisOne}</p>}
                    {place.postUrl && (
                      <a
                        href={place.postUrl}
                        target="_blank"
                        rel="noreferrer nofollow"
                        className="mt-1 inline-block text-xs text-primary"
                      >
                        Their post
                      </a>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        placeholder="Reason (for a rejection)"
                        value={notes[place.id] ?? ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [place.id]: e.target.value }))
                        }
                        className={field}
                      />
                      <button
                        onClick={() =>
                          decide.mutate({
                            id: place.id,
                            decision: "approved",
                            note: notes[place.id] ?? "",
                          })
                        }
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          decide.mutate({
                            id: place.id,
                            decision: "rejected",
                            note: notes[place.id] ?? "",
                          })
                        }
                        className="rounded-lg border border-border px-3 py-1 text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium">Payouts</h2>
              <div className="hairline-card mt-3 divide-y divide-border">
                {data.payouts.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No payouts drawn yet.</p>
                )}
                {data.payouts.map((row) => (
                  <form
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 p-4 text-sm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      paid.mutate({ id: row.id, reference: String(form.get("reference") ?? "") });
                    }}
                  >
                    <span>{row.periodMonth.slice(0, 7)}</span>
                    <span>{row.creatorHandle ? `/c/${row.creatorHandle}` : "—"}</span>
                    <span className="font-medium">{money(row.amountMinor)}</span>
                    <span className="text-muted-foreground">{row.status}</span>
                    {row.status === "paid" ? (
                      <span className="text-xs text-muted-foreground">{row.reference}</span>
                    ) : (
                      <>
                        <input name="reference" placeholder="Transfer reference" className={field} />
                        <button className="rounded-lg border border-border px-3 py-1 text-xs">
                          Mark paid
                        </button>
                      </>
                    )}
                  </form>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
