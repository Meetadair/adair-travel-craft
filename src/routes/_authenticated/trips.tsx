import { createFileRoute } from "@tanstack/react-router";
import { TripsPage } from "@/pages/trips";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({
    meta: [
      { title: "My trips · Adair" },
      {
        name: "description",
        content: "Every trip you booked with Adair, with its confirmation and status.",
      },
      { property: "og:title", content: "My trips · Adair" },
      {
        property: "og:description",
        content: "Every trip you booked with Adair, with its confirmation and status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripsPage,
});
