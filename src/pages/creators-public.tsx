/** Public one-screen page for the creator programme. */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";

const STEPS = [
  "Apply with your handle and where you publish.",
  "Recommend places you have stayed at or eaten at.",
  "Earn a share when a traveller books one.",
];

export function CreatorsPublicPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Recommend places you love. Earn when people book them.
        </h1>
        <ol className="mt-8 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-base text-muted-foreground">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-xs text-foreground">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <Link
          to="/creators/apply"
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Apply <ArrowRight className="size-4" />
        </Link>
      </main>
    </div>
  );
}
