import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/dashboard";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: pageMeta(en.dashboard.meta, "summary") }),
  component: DashboardPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-sm text-muted-foreground">
      {en.dashboard.loadError}
    </div>
  ),
});
