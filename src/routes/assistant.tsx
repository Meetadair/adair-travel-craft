import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/pages/assistant";
import { en } from "@/lib/i18n/locales/en";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: pageMeta(en.assistant.meta) }),
  component: AssistantPage,
});
