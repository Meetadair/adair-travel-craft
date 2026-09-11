import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/pages/plan";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Your plan · Adair" },
      {
        name: "description",
        content: "Free, Select and Signature: what each Adair plan gives a traveller.",
      },
      { property: "og:title", content: "Your plan · Adair" },
      {
        property: "og:description",
        content: "Free, Select and Signature: what each Adair plan gives a traveller.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});
