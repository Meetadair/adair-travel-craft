import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/pages/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms · Adair" },
      {
        name: "description",
        content: "The terms that apply when you book a trip through Adair.",
      },
      { property: "og:title", content: "Terms · Adair" },
      {
        property: "og:description",
        content: "The terms that apply when you book a trip through Adair.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage kind="terms" />,
});
