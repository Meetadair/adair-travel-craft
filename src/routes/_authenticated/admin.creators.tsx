import { createFileRoute } from "@tanstack/react-router";
import { AdminCreatorsPage } from "@/pages/admin-creators";

const description =
  "Creator applications, commission settings, pending place submissions and monthly payouts.";

export const Route = createFileRoute("/_authenticated/admin/creators")({
  head: () => ({
    meta: [
      { title: "Creators admin · Adair" },
      { name: "description", content: description },
      { property: "og:title", content: "Creators admin · Adair" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCreatorsPage,
});
