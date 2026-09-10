import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/pages/home";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/")({
  head: () => ({ meta: pageMeta(en.home.meta) }),
  component: HomePage,
});
