/** Invitation link: remembers the code, then sends the visitor to sign in. */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const REFERRAL_STORAGE_KEY = "adair.referral";

export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "You've been invited · Adair" },
      {
        name: "description",
        content:
          "An Adair traveller invited you. Join, book your first trip, and both of you receive travel credit.",
      },
      { property: "og:title", content: "You've been invited · Adair" },
      {
        property: "og:description",
        content: "Join Adair through an invitation and receive travel credit on your first trip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    } catch {
      // Private browsing can refuse storage; the invitation simply isn't kept.
    }
    void navigate({ to: "/auth", replace: true });
  }, [code, navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">You've been invited</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Taking you to sign in. Once your first trip is booked, you and the traveller who invited you
        both receive travel credit.
      </p>
    </main>
  );
}
