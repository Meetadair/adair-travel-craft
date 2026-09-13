/**
 * One suggestion per conversation that would make next time easier — and never
 * again once dismissed. Nudges are not advice: they are about the account, not
 * about this trip.
 */

export type NudgeKind = "connect_calendar" | "add_loyalty" | "save_company";

export type Nudge = {
  kind: NudgeKind;
  text: string;
  actionLabel: string;
  href: string;
};

export type NudgeCopy = {
  connectCalendar: string;
  connectCalendarAction: string;
  addLoyalty: string;
  addLoyaltyAction: string;
  saveCompany: string;
  saveCompanyAction: string;
};

export const NUDGE_COPY: NudgeCopy = {
  connectCalendar:
    "Next time I could pick this up from your calendar myself — connecting takes about three minutes.",
  connectCalendarAction: "Connect the calendar",
  addLoyalty: "You'd earn miles on this flight — add your frequent flyer number in Settings.",
  addLoyaltyAction: "Add the number",
  saveCompany: "Save the company once and I'll invoice it automatically.",
  saveCompanyAction: "Save the company",
};

export type NudgeContext = {
  business: boolean;
  calendarConnected: boolean;
  loyaltyCount: number;
  /** Set when the chosen flight is on an airline with a programme. */
  earnsMiles: boolean;
  askedForInvoice: boolean;
  hasDefaultCompany: boolean;
  /** Kinds already dismissed by this traveller. */
  dismissed?: NudgeKind[];
  copy?: NudgeCopy;
};

/** The single nudge to show, or null when nothing is worth saying. */
export function pickNudge(context: NudgeContext): Nudge | null {
  const copy = context.copy ?? NUDGE_COPY;
  const dismissed = context.dismissed ?? [];
  const candidates: Nudge[] = [];

  if (context.business && !context.calendarConnected) {
    candidates.push({
      kind: "connect_calendar",
      text: copy.connectCalendar,
      actionLabel: copy.connectCalendarAction,
      href: "/settings",
    });
  }
  if (context.askedForInvoice && !context.hasDefaultCompany) {
    candidates.push({
      kind: "save_company",
      text: copy.saveCompany,
      actionLabel: copy.saveCompanyAction,
      href: "/settings",
    });
  }
  if (context.earnsMiles && context.loyaltyCount === 0) {
    candidates.push({
      kind: "add_loyalty",
      text: copy.addLoyalty,
      actionLabel: copy.addLoyaltyAction,
      href: "/settings",
    });
  }

  return candidates.find((n) => !dismissed.includes(n.kind)) ?? null;
}

const KEY = "adair.nudges.dismissed";

/** Dismissals live in the browser, so a nudge never comes back. */
export function readDismissed(): NudgeKind[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed.filter((v) => typeof v === "string") as NudgeKind[]) : [];
  } catch {
    return [];
  }
}

export function rememberDismissed(kind: NudgeKind): NudgeKind[] {
  const next = Array.from(new Set([...readDismissed(), kind]));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private browsing — the nudge may appear again next session */
  }
  return next;
}
