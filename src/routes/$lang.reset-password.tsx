import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/pages/reset-password";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/reset-password")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).auth.meta, "summary") }),
  component: ResetPasswordPage,
});
