import { createFileRoute } from "@tanstack/react-router";
import { CreatorApplyPage } from "@/pages/creator-apply";

const description =
  "Apply to the Adair creator programme: share a link, recommend places you have actually been, and earn only when someone books.";

export const Route = createFileRoute("/_authenticated/creators/apply")({
  head: () => ({
    meta: [
      { title: "Apply as a creator · Adair" },
      { name: "description", content: description },
      { property: "og:title", content: "Apply as a creator · Adair" },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorApplyPage,
});
