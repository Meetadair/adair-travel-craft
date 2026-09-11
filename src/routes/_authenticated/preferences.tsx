import { createFileRoute } from "@tanstack/react-router";
import { PreferencesPage } from "@/pages/preferences";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [
      { title: "Travel preferences · Adair" },
      {
        name: "description",
        content: "Edit how Adair books for you: airport, airlines, cabin, hotels, cars, invoices.",
      },
      { property: "og:title", content: "Travel preferences · Adair" },
      {
        property: "og:description",
        content: "Edit how Adair books for you: airport, airlines, cabin, hotels, cars, invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreferencesPage,
});
