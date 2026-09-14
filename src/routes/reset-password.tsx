import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/pages/reset-password";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: pageMeta(en.auth.meta, "summary") }),
  component: ResetPasswordPage,
});
