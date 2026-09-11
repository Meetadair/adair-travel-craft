import { createFileRoute } from "@tanstack/react-router";
import { BusinessPage } from "@/pages/business";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/business")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).business.meta) }),
  component: BusinessPage,
});
