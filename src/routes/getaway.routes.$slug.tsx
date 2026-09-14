import { createFileRoute, useParams } from "@tanstack/react-router";
import { RouteDetailPage } from "@/pages/getaway-routes";

function RouteFromParams() {
  const { slug } = useParams({ from: "/getaway/routes/$slug" });
  return <RouteDetailPage slug={slug} />;
}

export const Route = createFileRoute("/getaway/routes/$slug")({
  component: RouteFromParams,
});
