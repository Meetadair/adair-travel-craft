/**
 * Shown after the essentials are done: a calm, dismissible nudge to finish the
 * optional half of the profile. Dismissal is remembered on the device.
 */
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { getAccount } from "@/lib/account.functions";
import { part2Completion } from "@/lib/prefs/questions";

const KEY = "adair.refine-prompt.dismissed";

export function RefineProfilePrompt() {
  const fetchAccount = useServerFn(getAccount);
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(KEY) === "1";
  });

  if (dismissed || !account.data) return null;
  const completion = part2Completion(account.data.preferences, account.data.companies.length);
  if (completion >= 80) return null;

  return (
    <div className="hairline-card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium">Your profile is {completion}% complete</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Two more minutes of taste — airlines, hotel style, food, music — and every suggestion fits
          you better.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/preferences"
          hash="refine"
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Finish profile
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            window.localStorage.setItem(KEY, "1");
            setDismissed(true);
          }}
          className="rounded-xl p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
