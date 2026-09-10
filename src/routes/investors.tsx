import { createFileRoute } from "@tanstack/react-router";
import { InvestorsPage } from "@/pages/investors";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/investors")({
  head: () => ({ meta: pageMeta(en.investors.meta) }),
  component: InvestorsPage,
});
