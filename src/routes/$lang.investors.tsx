import { createFileRoute } from "@tanstack/react-router";
import { InvestorsPage } from "@/pages/investors";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/investors")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).investors.meta) }),
  component: InvestorsPage,
});
