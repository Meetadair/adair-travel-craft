import { createFileRoute } from "@tanstack/react-router";
import { BookPage } from "@/pages/book";

export const Route = createFileRoute("/_authenticated/book/$cardId")({
  head: () => ({
    meta: [
      { title: "Confirm your trip · Adair" },
      {
        name: "description",
        content: "Review your flight, hotel and car, then confirm the whole trip at once.",
      },
      { property: "og:title", content: "Confirm your trip · Adair" },
      {
        property: "og:description",
        content: "Review your flight, hotel and car, then confirm the whole trip at once.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookRoute,
});

function BookRoute() {
  const { cardId } = Route.useParams();
  return <BookPage cardId={cardId} />;
}
