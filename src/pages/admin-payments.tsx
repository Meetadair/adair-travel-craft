/** Admin: which payment provider is active, and what every payment recorded. */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldAlert } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getPaymentAdmin, setActivePaymentProvider } from "@/lib/admin-payments.functions";

const MODEL_COPY: Record<string, string> = {
  "supplier-of-record": "Supplier collects — we never hold the money",
  "merchant-of-record": "We collect, then pay each supplier from our balance",
};

export function AdminPaymentsPage() {
  const fetchAdmin = useServerFn(getPaymentAdmin);
  const activate = useServerFn(setActivePaymentProvider);
  const queryClient = useQueryClient();

  const admin = useQuery({ queryKey: ["admin-payments"], queryFn: () => fetchAdmin() });
  const switchTo = useMutation({
    mutationFn: (provider: string) => activate({ data: { provider } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-payments"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The active provider is a config row. Switching it changes nothing else in the booking flow.
        </p>

        {admin.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {admin.isError && (
          <p className="mt-8 flex items-center gap-2 text-sm text-primary">
            <ShieldAlert className="size-4" /> Admins only.
          </p>
        )}

        {admin.data && (
          <div className="mt-8 space-y-6">
            <section className="hairline-card divide-y divide-border">
              {admin.data.providers.map((row) => (
                <div key={row.provider} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {row.label}
                      {row.enabled && (
                        <span className="ml-2 rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Active
                        </span>
                      )}
                      {row.testMode && (
                        <span className="ml-2 rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          Test mode
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {MODEL_COPY[row.settlementModel] ?? row.settlementModel} ·{" "}
                      {row.methods.length ? row.methods.join(", ") : "no methods"} ·{" "}
                      {row.configured ? "keys configured" : "keys missing"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={row.enabled || !row.configured || switchTo.isPending}
                    onClick={() => switchTo.mutate(row.provider)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Make active
                  </button>
                </div>
              ))}
            </section>

            <section className="hairline-card overflow-x-auto p-4">
              <h2 className="font-display text-lg font-semibold">Last 50 payments</h2>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Provider</th>
                    <th className="py-2 pr-3">Model</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Idempotency key</th>
                  </tr>
                </thead>
                <tbody>
                  {admin.data.payments.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="py-2 pr-3">{row.createdAt.slice(0, 16).replace("T", " ")}</td>
                      <td className="py-2 pr-3">{row.provider ?? "—"}</td>
                      <td className="py-2 pr-3">{row.settlementModel ?? "—"}</td>
                      <td className="py-2 pr-3">{row.method ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {(row.amountMinor / 100).toFixed(2)} {row.currency}
                      </td>
                      <td className="py-2 pr-3">{row.status}</td>
                      <td className="py-2 pr-3 font-mono">{row.idempotencyKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {admin.data.payments.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
