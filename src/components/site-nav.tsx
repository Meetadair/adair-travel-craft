import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import logoMark from "@/assets/logo-adair.png";
import { supabase } from "@/integrations/supabase/client";
import { ThemeNavToggle } from "@/components/theme-toggle";
import { useCurrency } from "@/lib/currency";
import { Coins } from "lucide-react";
import {
  LocaleLink,
  localeHref,
  localeNames,
  locales,
  useLocale,
  useT,
  type SitePath,
} from "@/lib/i18n";

const NAV: Array<{ to: SitePath; key: "assistant" }> = [{ to: "/assistant", key: "assistant" }];

function LanguageMenu() {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /** Same page in another language, when that page has a localized twin. */
  function hrefFor(next: string) {
    const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
    const known: SitePath[] = ["/", "/assistant", "/business", "/auth"];
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

function CurrencyMenu() {
  const { code, setCode, currencies } = useCurrency();
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t.nav.currency}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm"
      >
        <Coins className="size-4" />
        <span className="uppercase">{code}</span>
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul className="absolute right-0 z-50 mt-2 max-h-80 w-36 overflow-y-auto rounded-xl border border-border bg-card py-2 shadow-sm">
            {currencies.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    setCode(c);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-foreground hover:bg-secondary"
                >
                  {c}
                  {c === code && <Check className="size-3.5 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Viewer = { name: string | null; email: string | null; photo: string | null };

/** Avatar menu for the signed-in traveller: their photo or initial in coral. */
function AccountMenu({ viewer }: { viewer: Viewer }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const initial = (viewer.name?.trim() || viewer.email?.trim() || "A").charAt(0).toUpperCase();

  async function signOut() {
    setOpen(false);
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  const itemClass = "block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-secondary";

  return (
    <div className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-primary text-sm font-semibold text-primary-foreground"
      >
        {viewer.photo ? (
          <img src={viewer.photo} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-border bg-card py-2 shadow-sm">
            <Link to="/preferences" className={itemClass} onClick={() => setOpen(false)}>
              Settings
            </Link>
            <Link to="/invoices" className={itemClass} onClick={() => setOpen(false)}>
              Invoices
            </Link>
            <Link to="/credit" className={itemClass} onClick={() => setOpen(false)}>
              Credit &amp; referrals
            </Link>
            <Link to="/support" className={itemClass} onClick={() => setOpen(false)}>
              Help
            </Link>
            <button type="button" onClick={() => void signOut()} className={itemClass}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SiteNav() {
  const locale = useLocale();
  const t = useT();
  const [signedIn, setSignedIn] = useState(false);
  const [viewer, setViewer] = useState<Viewer>({ name: null, email: null, photo: null });

  useEffect(() => {
    const read = (
      user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
    ) => {
      setSignedIn(Boolean(user));
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const str = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : null);
      setViewer({
        name: str("full_name") ?? str("name"),
        email: user?.email ?? null,
        photo: str("avatar_url") ?? str("picture"),
      });
    };
    supabase.auth.getUser().then(({ data }) => read(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        read(session?.user ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const linkClass =
    "rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:text-sm";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <LocaleLink to="/" locale={locale} className="flex items-center gap-2">
          {/* The wordmark is dark ink on a transparent background, so on the dark
              ground it would all but vanish. Flattening it to black and then
              inverting gives us the off-white version we have no file for. */}
          <img
            src={logoMark}
            alt="Adair"
            className="h-6 w-auto dark:opacity-90 dark:brightness-0 dark:invert"
            loading="eager"
          />
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
          <Link
            to={signedIn ? "/trips" : "/dashboard"}
            className={linkClass}
            activeProps={{ className: "text-foreground" }}
          >
            {t.nav.trips}
          </Link>
          {signedIn && (
            <>
              <Link
                to="/getaway"
                className={linkClass}
                activeProps={{ className: "text-foreground" }}
              >
                Getaway
              </Link>
              {/* Settings, Invoices, Credit and Help live in the avatar menu. */}
            </>
          )}
          <ThemeNavToggle />
          <CurrencyMenu />
          <LanguageMenu />
          {signedIn ? (
            <AccountMenu viewer={viewer} />
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
