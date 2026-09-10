import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).home.meta) }),
  component: HomePage,
});
