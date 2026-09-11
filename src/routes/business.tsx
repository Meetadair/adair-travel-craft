import { createFileRoute } from "@tanstack/react-router";
import { BusinessPage } from "@/pages/business";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/business")({
  head: () => ({ meta: pageMeta(en.business.meta) }),
  component: BusinessPage,
});
