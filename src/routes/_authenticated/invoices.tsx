import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/pages/invoices";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices · Adair" },
      {
        name: "description",
        content:
          "Your Adair trips with the company they are billed to, plus PDF and VAT invoice downloads.",
      },
      { property: "og:title", content: "Invoices · Adair" },
      {
        property: "og:description",
        content:
          "Your Adair trips with the company they are billed to, plus PDF and VAT invoice downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoicesPage,
});
