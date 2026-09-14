/**
 * Cookie consent.
 *
 * Only two categories, because only two exist here: what the site needs to
 * work, and what tells us how it is used. Nothing is set before the traveller
 * chooses, refusing is one tap, and the choice can be changed any time from the
 * footer — under the GDPR, withdrawing consent must be as easy as giving it.
 *
 * The choice lives in this browser. It is not an account setting and never
 * follows anyone between devices.
 */

export type CookieChoice = {
  /** Always on: sessions, security, the language you picked. */
  essential: true;
  /** Our own page counts. Off until someone says yes. */
  analytics: boolean;
  decidedAt: string;
};

const KEY = "adair.cookie-choice";
const EVENT = "adair:cookie-settings";

/** What we do when nobody has decided: the least we can get away with. */
export const DEFAULT_CHOICE: CookieChoice = {
  essential: true,
  analytics: false,
  decidedAt: "",
};

export function readCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieChoice>;
    if (typeof parsed.analytics !== "boolean") return null;
    return { essential: true, analytics: parsed.analytics, decidedAt: parsed.decidedAt ?? "" };
  } catch {
    // Private browsing, or something else wrote to the key. Treat as undecided
    // rather than assuming consent.
    return null;
  }
}

export function writeCookieChoice(analytics: boolean): CookieChoice {
  const choice: CookieChoice = {
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    /* nothing we can do; the session simply asks again next time */
  }
  return choice;
}

/** True when analytics may run. Absent consent is a no, never a maybe. */
export function analyticsAllowed(): boolean {
  return readCookieChoice()?.analytics === true;
}

/** Opens the panel from anywhere — the footer link, or the first-visit banner. */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onCookieSettingsOpen(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
