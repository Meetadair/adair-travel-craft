/**
 * Home-screen nudge for travellers who said in onboarding that they hold
 * loyalty programmes but haven't saved a number yet. Dismissible, and it stops
 * showing by itself once the first programme is saved.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { getLoyaltyReminder } from "@/lib/loyalty.functions";

const DISMISS_KEY = "adair.loyalty-reminder.dismissed";

export function LoyaltyReminder() {
  const check = useServerFn(getLoyaltyReminder);
  const [dismissed, setDismissed] = useState(true);

  // Read the dismissal after hydration so server and client render the same.
  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const reminder = useQuery({
    queryKey: ["loyalty-reminder"],
    queryFn: () => check(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (dismissed || !reminder.data?.show) return null;

  return (
    <div className="mt-6 flex flex-wrap items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        You said you collect miles and points. Add your member numbers in{" "}
        <Link
          to="/preferences"
          hash="wallet"
          className="text-primary underline decoration-border underline-offset-4"
        >
          Settings → Saved details
        </Link>{" "}
        and we'll pass them at every booking.
      </p>
      <button
        type="button"
        aria-label="Dismiss reminder"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* private browsing — the reminder simply returns next visit */
          }
        }}
        className="inline-flex min-h-8 items-center text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
