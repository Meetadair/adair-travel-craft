import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/pages/auth";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: pageMeta(en.auth.meta, "summary") }),
  component: AuthPage,
});
