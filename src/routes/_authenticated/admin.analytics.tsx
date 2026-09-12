import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalyticsPage } from "@/pages/admin-analytics";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Adair admin" },
      {
        name: "description",
        content: "Funnel, onboarding, searches, swap reasons, bookings and failures for Adair.",
      },
      { property: "og:title", content: "Analytics · Adair admin" },
      {
        property: "og:description",
        content: "Funnel, onboarding, searches, swap reasons, bookings and failures for Adair.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAnalyticsPage,
});
