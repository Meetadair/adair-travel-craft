/** Minimal admin panel: pricing, bookings, users, providers, keys, errors. */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import {
  cancelTripAsAdmin,
  getAdminOverview,
  getAdminTrip,
  savePricingRule,
  setProviderEnabled,
  setUserAdmin,
  listWaitlist,
  inviteWaitlist,
  type PricingRuleRow,
} from "@/lib/admin.functions";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RuleRow({ rule, onSaved }: { rule: PricingRuleRow; onSaved: () => void }) {
  const save = useServerFn(savePricingRule);
  const [markup, setMarkup] = useState(String(rule.markup_bps));
  const [discount, setDiscount] = useState(String(rule.discount_bps));
  const [fee, setFee] = useState(String(rule.change_fee_minor));

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: rule.id,
          markupBps: Number(markup),
          discountBps: Number(discount),
          changeFeeMinor: Number(fee),
        },
      }),
    onSuccess: onSaved,
  });

  const field = "w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <p className="min-w-[9rem] text-sm font-medium">
        {rule.plan} · {rule.line_type}
      </p>
      <label className="text-xs text-muted-foreground">
        Markup bps
        <input className={`${field} mt-1 block`} value={markup} onChange={(e) => setMarkup(e.target.value)} />
      </label>
      <label className="text-xs text-muted-foreground">
        Discount bps
        <input className={`${field} mt-1 block`} value={discount} onChange={(e) => setDiscount(e.target.value)} />
      </label>
      <label className="text-xs text-muted-foreground">
        Change fee (minor)
        <input className={`${field} mt-1 block`} value={fee} onChange={(e) => setFee(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-primary hover:border-primary disabled:opacity-60"
      >
        {mutation.isPending ? "Saving…" : mutation.isSuccess ? "Saved" : "Save"}
      </button>
      {mutation.isError && <span className="text-xs text-primary">Could not save.</span>}
    </div>
  );
}

function WaitlistCard() {
  const fetchWaitlist = useServerFn(listWaitlist);
  const invite = useServerFn(inviteWaitlist);
  const queryClient = useQueryClient();
  const rows = useQuery({ queryKey: ["admin-waitlist"], queryFn: () => fetchWaitlist() });
  const [note, setNote] = useState("");

  const send = useMutation({
    mutationFn: (ids: string[]) => invite({ data: { ids } }),
    onSuccess: (result) => {
      setNote(`${result.invited} invited · ${result.skipped} already done · ${result.failed} failed`);
      void queryClient.invalidateQueries({ queryKey: ["admin-waitlist"] });
    },
    onError: () => setNote("Invitations could not be sent just now."),
  });

  const pending = (rows.data ?? []).filter((row) => !row.invitedAt && !row.hasAccount);

  return (
    <Card
      title="Waitlist"
      hint="Turn sign-ups into real account invitations so both lists stay in step."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={!pending.length || send.isPending}
          onClick={() => send.mutate(pending.slice(0, 50).map((row) => row.id))}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {send.isPending ? "Inviting…" : `Invite ${Math.min(pending.length, 50)} waiting`}
        </button>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <div className="hairline-card mt-4 divide-y divide-border">
        {(rows.data ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nobody on the waitlist yet.</p>
        )}
        {(rows.data ?? []).slice(0, 40).map((row) => (
          <p key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
            <span className="min-w-0 truncate">{row.email}</span>
            <span className="text-xs text-muted-foreground">
              {row.type} ·{" "}
              {row.hasAccount
                ? "account"
                : row.invitedAt
                  ? "invited"
                  : row.inviteError
                    ? `failed: ${row.inviteError}`
                    : "waiting"}
            </span>
          </p>
        ))}
      </div>
    </Card>
  );
}

export function AdminPage() {
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchTrip = useServerFn(getAdminTrip);
  const toggleProvider = useServerFn(setProviderEnabled);
  const flagUser = useServerFn(setUserAdmin);
  const cancelTrip = useServerFn(cancelTripAsAdmin);
  const queryClient = useQueryClient();
  const [openTrip, setOpenTrip] = useState<string | null>(null);

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
  const trip = useQuery({
    queryKey: ["admin-trip", openTrip],
    queryFn: () => fetchTrip({ data: { tripId: openTrip! } }),
    enabled: Boolean(openTrip),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  const providerMutation = useMutation({
    mutationFn: (input: { id: string; enabled: boolean }) => toggleProvider({ data: input }),
    onSuccess: refresh,
  });
  const adminMutation = useMutation({
    mutationFn: (input: { userId: string; isAdmin: boolean }) => flagUser({ data: input }),
    onSuccess: refresh,
  });
  const cancelMutation = useMutation({
    mutationFn: (input: { tripId: string; reason: string }) => cancelTrip({ data: input }),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ["admin-trip"] });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything here changes live, without a deploy. Every change is written to the audit log.
        </p>
        <p className="mt-3 flex gap-4 text-sm">
          <Link to="/admin/analytics" className="text-primary underline-offset-4 hover:underline">
            Analytics
          </Link>
          <Link to="/admin/payments" className="text-primary underline-offset-4 hover:underline">
            Payments
          </Link>
        </p>

        {overview.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {overview.isError && (
          <p className="mt-8 flex items-center gap-2 text-sm text-primary">
            <ShieldAlert className="size-4" /> Admins only.
          </p>
        )}

        {overview.data && (
          <>
            <Card title="Pricing rules" hint="Markup, discount and change fee per plan and line.">
              <div className="hairline-card divide-y divide-border">
                {overview.data.pricingRules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} onSaved={refresh} />
                ))}
              </div>
            </Card>

            <Card title="Bookings">
              <div className="hairline-card divide-y divide-border">
                {overview.data.bookings.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No bookings yet.</p>
                )}
                {overview.data.bookings.map((booking) => (
                  <div key={booking.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{booking.title}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {booking.user_email ?? "unknown"} · {booking.status} ·{" "}
                          {booking.currency} {booking.total_amount}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenTrip(openTrip === booking.id ? null : booking.id)}
                        className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-primary"
                      >
                        {openTrip === booking.id ? "Close" : "Open"}
                      </button>
                      {booking.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={() =>
                            cancelMutation.mutate({ tripId: booking.id, reason: "admin cancel" })
                          }
                          disabled={cancelMutation.isPending}
                          className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-primary hover:border-primary disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {openTrip === booking.id && (
                      <div className="mt-3 rounded-xl border border-border p-3 text-xs text-muted-foreground">
                        {trip.isLoading && <p>Loading…</p>}
                        {trip.data?.items.map((item, index) => (
                          <p key={index}>
                            {String(item["kind"])} · {String(item["title"])} ·{" "}
                            {String(item["status"])} ·{" "}
                            {(Number(item["gross_minor"] ?? 0) / 100).toFixed(2)}{" "}
                            {String(item["currency"] ?? "EUR")}
                            {Array.isArray(item["documents"]) && item["documents"].length > 0
                              ? ` · ${item["documents"].length} document(s)`
                              : ""}
                          </p>
                        ))}
                        {trip.data?.payments.map((payment, index) => (
                          <p key={`p${index}`} className="mt-1">
                            Payment · {String(payment["provider"])} · {String(payment["status"])} ·{" "}
                            {(Number(payment["amount_minor"] ?? 0) / 100).toFixed(2)}{" "}
                            {String(payment["currency"] ?? "EUR")}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Users">
              <div className="hairline-card divide-y divide-border">
                {overview.data.users.map((user) => (
                  <div key={user.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                    <p className="min-w-0 flex-1">
                      <span className="font-medium">{user.full_name ?? user.email ?? user.id}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {user.plan} · onboarding {user.onboarded ? "done" : "not finished"} ·
                        preferences {user.preferences_filled}%
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => adminMutation.mutate({ userId: user.id, isAdmin: !user.is_admin })}
                      disabled={adminMutation.isPending}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-60"
                    >
                      {user.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Providers" hint="Switch a supplier on or off per category.">
              <div className="hairline-card divide-y divide-border">
                {overview.data.providers.map((provider) => (
                  <div key={provider.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                    <p className="min-w-0 flex-1">
                      <span className="font-medium">{provider.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {provider.category} · priority {provider.priority}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        providerMutation.mutate({ id: provider.id, enabled: !provider.enabled })
                      }
                      disabled={providerMutation.isPending}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-primary disabled:opacity-60"
                    >
                      {provider.enabled ? "Turn off" : "Turn on"}
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Keys" hint="Names only — values are never shown.">
              <div className="hairline-card divide-y divide-border">
                {overview.data.secrets.map((secret) => (
                  <p key={secret.name} className="p-3 text-sm">
                    <span className="font-medium">{secret.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {secret.configured ? "configured" : "not set"}
                    </span>
                  </p>
                ))}
              </div>
            </Card>

            <WaitlistCard />

            <Card title="Recent errors">
              <div className="hairline-card divide-y divide-border">
                {overview.data.errors.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">No errors recorded.</p>
                )}
                {overview.data.errors.map((error) => (
                  <p key={error.id} className="p-3 text-xs">
                    <span className="text-muted-foreground">
                      {new Date(error.created_at).toLocaleString()} · {error.route ?? "unknown route"}
                    </span>
                    <br />
                    {error.message}
                  </p>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
