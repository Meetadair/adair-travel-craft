import { createFileRoute } from "@tanstack/react-router";
import { AdminGetawayPage } from "@/pages/admin-getaway";

const description =
  "Editorial tools for Adair Getaway: themes, destinations, season windows, curated places and day-by-day itineraries.";

export const Route = createFileRoute("/_authenticated/admin/getaway")({
  head: () => ({
    meta: [
      { title: "Getaway editorial · Adair admin" },
      { name: "description", content: description },
      { property: "og:title", content: "Getaway editorial · Adair admin" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminGetawayPage,
});
