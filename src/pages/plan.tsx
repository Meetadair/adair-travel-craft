import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getAccount } from "@/lib/account.functions";
import { AppFooter } from "@/components/app-footer";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    note: "Pay per trip",
    lines: ["One window for the whole trip", "Standard prices", "Changes: 20 EUR fee"],
  },
  {
    id: "select",
    name: "Select",
    price: "9",
    note: "per month",
    lines: ["3% off every trip", "Priority understanding of your rules", "Changes: 15 EUR fee"],
  },
  {
    id: "signature",
    name: "Signature",
    price: "29",
    note: "per month",
    lines: ["6% off every trip", "No change fees", "Human help when a trip goes sideways"],
  },
];

export function PlanPage() {
  const fetchAccount = useServerFn(getAccount);
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });
  const current = account.data?.plan ?? "free";

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are on <span className="text-foreground">{current}</span>. Paid plans open together
          with card payments.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`hairline-card p-6 ${plan.id === current ? "border-primary" : ""}`}
            >
              <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
              <p className="mt-3">
                <span className="font-display text-3xl font-semibold text-primary">
                  {plan.price} EUR
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{plan.note}</p>
              <ul className="mt-5 space-y-2">
                {plan.lines.map((line) => (
                  <li key={line} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {line}
                  </li>
                ))}
              </ul>
              <button
                disabled
                title="Card payments are not open yet"
                className="mt-6 w-full cursor-not-allowed rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-semibold text-muted-foreground"
              >
                {plan.id === current ? "Current plan" : "Coming soon"}
              </button>
            </article>
          ))}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
