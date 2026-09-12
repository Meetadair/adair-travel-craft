import { createFileRoute } from "@tanstack/react-router";
import { SupportPage } from "@/pages/support";

export const Route = createFileRoute("/_authenticated/support")({
  validateSearch: (search: Record<string, unknown>): { trip?: string; category?: string } => ({
    trip: typeof search["trip"] === "string" ? (search["trip"] as string) : undefined,
    category: typeof search["category"] === "string" ? (search["category"] as string) : undefined,
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
