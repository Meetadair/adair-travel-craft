import { createFileRoute } from "@tanstack/react-router";
import { CreatorPage } from "@/pages/creator";

const description =
  "Your creator link, real click and booking counts, earnings by month and a statement for your own invoicing.";

export const Route = createFileRoute("/_authenticated/creator")({
  head: () => ({
    meta: [
      { title: "Your creator page · Adair" },
      { name: "description", content: description },
      { property: "og:title", content: "Your creator page · Adair" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorPage,
});
