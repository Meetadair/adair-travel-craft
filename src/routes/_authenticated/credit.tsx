import { createFileRoute } from "@tanstack/react-router";
import { CreditPage } from "@/pages/credit";

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Credit & invites · Adair" },
      {
        name: "description",
        content:
          "Your Adair travel credit balance, history, and your personal invitation link for fellow travellers.",
      },
      { property: "og:title", content: "Credit & invites · Adair" },
      {
        property: "og:description",
        content: "Travel credit balance, history and your Adair invitation link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreditPage,
});
