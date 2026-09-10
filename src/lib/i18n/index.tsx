import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { en, type Dict } from "./locales/en";
import de from "./locales/de.json";
import ja from "./locales/ja.json";
import uk from "./locales/uk.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import sr from "./locales/sr.json";
import fi from "./locales/fi.json";
import no from "./locales/no.json";
import sv from "./locales/sv.json";
import pl from "./locales/pl.json";

export type { Dict };

export const locales = [
  "en",
  "de",
  "ja",
  "uk",
  "zh",
  "es",
  "pt",
  "fr",
  "it",
  "sr",
  "fi",
  "no",
  "sv",
  "pl",
] as const;

export type Locale = (typeof locales)[number];

/** Native language names for the switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  uk: "Українська",
  zh: "中文",
  es: "Español",
  pt: "Português",
  fr: "Français",
  it: "Italiano",
  sr: "Srpski",
  fi: "Suomi",
  no: "Norsk",
  sv: "Svenska",
  pl: "Polski",
};

const dictionaries: Record<Locale, Dict> = {
  en,
  de: de as unknown as Dict,
  ja: ja as unknown as Dict,
  uk: uk as unknown as Dict,
  zh: zh as unknown as Dict,
  es: es as unknown as Dict,
  pt: pt as unknown as Dict,
  fr: fr as unknown as Dict,
  it: it as unknown as Dict,
  sr: sr as unknown as Dict,
  fi: fi as unknown as Dict,
  no: no as unknown as Dict,
  sv: sv as unknown as Dict,
  pl: pl as unknown as Dict,
};

export function isLocale(value: string | undefined): value is Locale {
  return Boolean(value) && (locales as readonly string[]).includes(value as string);
}

/** Dictionary for any locale-ish string; falls back to English. */
export function dict(locale: string | undefined): Dict {
  return isLocale(locale) ? dictionaries[locale] : en;
}

const STORAGE_KEY = "adair-locale";

/**
 * Locale of the current URL (first path segment). Pages without a localized
 * URL — the signed-in dashboard — reuse the language last chosen in the browser.
 */
export function useLocale(): Locale {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/")[1];
  const fromPath = isLocale(first) ? first : null;
  /** Only the auth-only dashboard has no localized URL of its own. */
  const usesStored = pathname.startsWith("/dashboard");
  const [stored, setStored] = useState<Locale | null>(null);

  useEffect(() => {
    if (fromPath) {
      window.localStorage.setItem(STORAGE_KEY, fromPath);
      setStored(fromPath);
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved ?? undefined)) setStored(saved as Locale);
  }, [fromPath]);

  return fromPath ?? (usesStored ? stored : null) ?? "en";
}

export function useT(): Dict {
  return dictionaries[useLocale()];
}

/** BCP 47 tag for <html lang> and number formatting. */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-Hans" : locale;
}

export type SitePath = "/" | "/assistant" | "/auth";

/** Link that keeps the visitor inside the current language. */
export function LocaleLink({
  to,
  locale,
  className,
  activeClassName,
  children,
}: {
  to: SitePath;
  locale: Locale;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  const activeProps = activeClassName ? { className: activeClassName } : undefined;

  if (locale === "en") {
    return (
      <Link to={to} className={className} {...(activeProps ? { activeProps } : {})}>
        {children}
      </Link>
    );
  }

  const localized = {
    "/": "/$lang",
    "/assistant": "/$lang/assistant",
    "/auth": "/$lang/auth",
  } as const;

  return (
    <Link
      to={localized[to]}
      params={{ lang: locale }}
      className={className}
      {...(activeProps ? { activeProps } : {})}
    >
      {children}
    </Link>
  );
}

/** Plain href for the same set of paths (used by the language switcher). */
export function localeHref(locale: Locale, to: SitePath): string {
  if (locale === "en") return to;
  return to === "/" ? `/${locale}` : `/${locale}${to}`;
}
