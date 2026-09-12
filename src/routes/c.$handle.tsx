import { createFileRoute } from "@tanstack/react-router";
import { CreatorProfilePage } from "@/pages/creator-profile";

const description =
  "Places this Adair creator partner recommends, with their own notes and photos. Creators earn only when someone books.";

export const Route = createFileRoute("/c/$handle")({
  head: () => ({
    meta: [
      { title: "Creator picks · Adair" },
      { name: "description", content: description },
      { property: "og:title", content: "Creator picks · Adair" },
      { property: "og:description", content: description },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileRoute,
});

function ProfileRoute() {
  const { handle } = Route.useParams();
  return <CreatorProfilePage handle={handle} />;
}
