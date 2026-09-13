import { createFileRoute } from "@tanstack/react-router";
import { AdminBrandsPage } from "@/pages/admin-brands";

export const Route = createFileRoute("/_authenticated/admin/brands")({
  head: () => ({
    meta: [
      { title: "Brands admin · Adair" },
      {
        name: "description",
        content: "Rank, add and retire the airlines, hotel groups and car rental brands customers pick from.",
      },
      { property: "og:title", content: "Brands admin · Adair" },
      {
        property: "og:description",
        content: "Rank, add and retire the airlines, hotel groups and car rental brands customers pick from.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminBrandsPage,
});
