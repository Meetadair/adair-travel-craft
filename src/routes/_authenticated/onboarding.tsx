import { createFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/pages/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your travel profile · Adair" },
      {
        name: "description",
        content: "Tell Adair once how you travel: airport, seat, cabin, hotel rules, invoices.",
      },
      { property: "og:title", content: "Set up your travel profile · Adair" },
      {
        property: "og:description",
        content: "Tell Adair once how you travel: airport, seat, cabin, hotel rules, invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});
