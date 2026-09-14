/**
 * The cookie notice and the panel behind it.
 *
 * The banner appears once, until a choice is made. Accepting and refusing are
 * the same size and the same weight — a refusal hidden behind a grey link is
 * not a free choice. Reopening the panel from the footer shows the current
 * setting, not a blank slate.
 */
import { useEffect, useState } from "react";

import { onCookieSettingsOpen, readCookieChoice, writeCookieChoice } from "@/lib/cookies";

const button =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium";

export function CookieNotice() {
  /** Null until we have read the browser: nothing renders during that moment. */
  const [decided, setDecided] = useState<boolean | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const existing = readCookieChoice();
    setDecided(existing !== null);
    setAnalytics(existing?.analytics ?? false);
    return onCookieSettingsOpen(() => {
      setAnalytics(readCookieChoice()?.analytics ?? false);
      setPanelOpen(true);
    });
  }, []);

  const save = (value: boolean) => {
    writeCookieChoice(value);
    setAnalytics(value);
    setDecided(true);
    setPanelOpen(false);
  };

  if (decided === null) return null;
  if (decided && !panelOpen) return null;

  if (panelOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-4 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie settings"
          className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg"
        >
          <h2 className="font-display text-lg font-semibold">Cookie settings</h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Needed to run the site</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keeps you signed in, remembers your language, protects the checkout. Always on —
                without these the site does not work.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="text-sm font-medium">How the site is used</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Our own page counts, so we can see what is broken. No advertising networks and no
                  third-party trackers.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => save(analytics)}
              className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              Save my choice
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              className={`${button} border border-border hover:border-primary`}
            >
              Refuse everything optional
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-4">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
          We use what the site needs to work, and — only if you agree — our own page counts. No
          advertising trackers.
        </p>
        <button
          type="button"
          onClick={() => save(true)}
          className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          className={`${button} border border-border hover:border-primary`}
        >
          Refuse
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
        >
          Settings
        </button>
      </div>
    </div>
  );
}
