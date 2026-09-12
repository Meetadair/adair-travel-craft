import { createFileRoute } from "@tanstack/react-router";
import { GetawayPage } from "@/pages/getaway";

const description =
  "This week's Adair Getaway: one curated destination matched to your interests, the right season and real travel time from your home airport.";

export const Route = createFileRoute("/_authenticated/getaway")({
  head: () => ({
    meta: [
      { title: "Getaway · Adair" },
      { name: "description", content: description },
      { property: "og:title", content: "Getaway · Adair" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetawayPage,
});
