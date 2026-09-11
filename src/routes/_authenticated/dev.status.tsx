import { createFileRoute } from "@tanstack/react-router";
import { StatusPage } from "@/pages/status";

export const Route = createFileRoute("/_authenticated/dev/status")({
  head: () => ({
    meta: [
      { title: "What is live · Adair" },
      {
        name: "description",
        content: "Live check of flights, hotels, cars, understanding and payments.",
      },
      { property: "og:title", content: "What is live · Adair" },
      {
        property: "og:description",
        content: "Live check of flights, hotels, cars, understanding and payments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusPage,
});
