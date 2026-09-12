import { createFileRoute } from "@tanstack/react-router";
import { AdminPaymentsPage } from "@/pages/admin-payments";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments admin · Adair" },
      {
        name: "description",
        content: "Switch the active payment provider and review every recorded payment.",
      },
      { property: "og:title", content: "Payments admin · Adair" },
      {
        property: "og:description",
        content: "Switch the active payment provider and review every recorded payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPaymentsPage,
});
