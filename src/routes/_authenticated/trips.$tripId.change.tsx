import { createFileRoute } from "@tanstack/react-router";
import { TripChangePage } from "@/pages/trip-change";

export const Route = createFileRoute("/_authenticated/trips/$tripId/change")({
  head: () => ({
    meta: [
      { title: "Change this trip · Adair" },
      {
        name: "description",
        content: "Change one thing about a booked trip and see the price difference first.",
      },
      { property: "og:title", content: "Change this trip · Adair" },
      {
        property: "og:description",
        content: "Change one thing about a booked trip and see the price difference first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { tripId } = Route.useParams();
  return <TripChangePage tripId={tripId} />;
}
