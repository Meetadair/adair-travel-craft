import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/pages/auth";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/auth")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).auth.meta, "summary") }),
  component: AuthPage,
});
