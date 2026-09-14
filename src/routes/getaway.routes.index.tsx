import { createFileRoute } from "@tanstack/react-router";
import { RoutesIndexPage } from "@/pages/getaway-routes";

export const Route = createFileRoute("/getaway/routes/")({
  component: RoutesIndexPage,
});
