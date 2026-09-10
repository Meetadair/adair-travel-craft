import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/pages/assistant";
import { dict } from "@/lib/i18n";
import { pageMeta } from "@/lib/i18n/meta";

export const Route = createFileRoute("/$lang/assistant")({
  head: ({ params }) => ({ meta: pageMeta(dict(params.lang).assistant.meta) }),
  component: AssistantPage,
});
