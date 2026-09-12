import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/pages/support";

export const Route = createFileRoute("/_authenticated/support")({
  validateSearch: (search: Record<string, unknown>): { trip?: string; category?: string } => ({
    ...(typeof search["trip"] === "string" ? { trip: search["trip"] as string } : {}),
    ...(typeof search["category"] === "string" ? { category: search["category"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Help · Adair" },
      {
        name: "description",
        content: "Reach a person about a booked trip: changes, cancellations, airport problems.",
      },
      { property: "og:title", content: "Help · Adair" },
      {
        property: "og:description",
        content: "Reach a person about a booked trip: changes, cancellations, airport problems.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});
