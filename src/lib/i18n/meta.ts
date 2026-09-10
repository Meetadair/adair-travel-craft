/** Builds a route head() meta array from a dictionary meta block. */
export function pageMeta(
  m: { title: string; description: string; ogTitle: string; ogDescription: string },
  card: "summary" | "summary_large_image" = "summary_large_image",
) {
  return [
    { title: m.title },
    { name: "description", content: m.description },
    { property: "og:title", content: m.ogTitle },
    { property: "og:description", content: m.ogDescription },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: card },
  ];
}
