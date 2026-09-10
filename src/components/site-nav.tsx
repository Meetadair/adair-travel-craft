import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LocaleLink,
  localeHref,
  localeNames,
  locales,
  useLocale,
  useT,
  type SitePath,
} from "@/lib/i18n";

const NAV: Array<{ to: SitePath; key: "assistant" }> = [
  { to: "/assistant", key: "assistant" },
];

function LanguageMenu() {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /** Same page in another language, when that page has a localized twin. */
  function hrefFor(next: string) {
    const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    const known: SitePath[] = ["/", "/assistant", "/auth"];
    const target = (known.includes(stripped as SitePath) ? stripped : "/") as SitePath;
    return localeHref(next as (typeof locales)[number], target);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t.nav.language}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
      >
        <Globe className="size-4" />
        <span className="uppercase">{locale}</span>
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul className="absolute right-0 z-50 mt-2 max-h-80 w-48 overflow-y-auto rounded-xl border border-border bg-card py-2 shadow-sm">
            {locales.map((l) => (
              <li key={l}>
                <a
                  href={hrefFor(l)}
                  className="flex items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  {localeNames[l]}
                  {l === locale && <Check className="size-3.5 text-primary" />}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SiteNav() {
  const locale = useLocale();
  const t = useT();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSignedIn(Boolean(session?.user));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const linkClass =
    "rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <LocaleLink to="/" locale={locale} className="font-display text-lg font-semibold tracking-tight">
          Adair.
        </LocaleLink>
        <div className="flex items-center gap-1 sm:gap-2">
          {NAV.map((l) => (
            <LocaleLink
              key={l.to}
              to={l.to}
              locale={locale}
              className={linkClass}
              activeClassName="text-foreground"
            >
              {t.nav[l.key]}
            </LocaleLink>
          ))}
          <Link to="/dashboard" className={linkClass} activeProps={{ className: "text-foreground" }}>
            {t.nav.trips}
          </Link>
          <LanguageMenu />
          {signedIn ? (
            <Link
              to="/dashboard"
              className="ml-1 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold sm:text-sm"
            >
              {t.nav.account}
            </Link>
          ) : (
            <LocaleLink
              to="/auth"
              locale={locale}
              className="ml-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:text-sm"
            >
              {t.nav.signIn}
            </LocaleLink>
          )}
        </div>
      </nav>
    </header>
  );
}
