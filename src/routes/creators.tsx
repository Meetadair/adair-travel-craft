import { createFileRoute } from "@tanstack/react-router";
import { CreatorsPublicPage } from "@/pages/creators-public";

const title = "For creators · Adair";
const description =
  "Recommend places you love and earn a share when a traveller books one. Apply to the Adair creator programme.";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://adair.kramdevelopment.com/creators" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://adair.kramdevelopment.com/creators" }],
  }),
  component: CreatorsPublicPage,
});
