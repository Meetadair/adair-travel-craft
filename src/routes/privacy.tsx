import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/pages/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · Adair" },
      {
        name: "description",
        content: "How Adair handles your travel data, the choices you have, and how to contact us.",
      },
      { property: "og:title", content: "Privacy · Adair" },
      {
        property: "og:description",
        content: "How Adair handles your travel data, the choices you have, and how to contact us.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LegalPage kind="privacy" />,
});
