import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/pages/admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin · Adair" },
      {
        name: "description",
        content: "Edit pricing rules, review bookings, manage users, providers and recent errors.",
      },
      { property: "og:title", content: "Admin · Adair" },
      {
        property: "og:description",
        content: "Edit pricing rules, review bookings, manage users, providers and recent errors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});
