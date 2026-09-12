/**
 * Creator commission maths. Kept pure and browser-safe so it can be tested and
 * shown in the dashboard without touching the database.
 *
 * The rule that must hold: a creator is paid a share of OUR margin, never a
 * share of the traveller's total, and never for placement. Nothing accrues
 * until a booking is confirmed.
 */

/** Monthly payout floor. Below this the balance simply rolls over. */
export const PAYOUT_MINIMUM_MINOR = 5000; // €50

/** Days after booking before a pending line can be confirmed (free-cancellation window). */
export const CANCELLATION_WINDOW_DAYS = 14;

export type EarningStatus = "pending" | "confirmed" | "reversed" | "paid";

/**
 * What we actually earned on a line. When the supplier net price was recorded
 * we use it; otherwise the margin is derived from the markup that produced the
 * gross price. Never guess upwards.
 */
export function marginMinor(
  grossMinor: number,
  netMinor: number | null,
  markupBps: number,
): number {
  if (grossMinor <= 0) return 0;
  if (netMinor && netMinor > 0 && netMinor < grossMinor) return grossMinor - netMinor;
  if (markupBps <= 0) return 0;
  return Math.round((grossMinor * markupBps) / (10000 + markupBps));
}

/** The creator's cut of that margin. */
export function commissionMinor(margin: number, shareBps: number): number {
  if (margin <= 0 || shareBps <= 0) return 0;
  return Math.floor((margin * shareBps) / 10000);
}

/** Attribution earns for a fixed window from the first attribution, not one booking. */
export function withinEarningWindow(earningUntilIso: string, now = new Date()): boolean {
  const until = Date.parse(earningUntilIso);
  return Number.isFinite(until) && now.getTime() <= until;
}

export function confirmableAt(bookedAt: Date, days = CANCELLATION_WINDOW_DAYS): string {
  return new Date(bookedAt.getTime() + days * 86_400_000).toISOString();
}

/** A handle that is safe in a URL. Empty when the input cannot make one. */
export function normaliseHandle(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return cleaned.length >= 3 ? cleaned : "";
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCreatorCode(): string {
  let out = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `CR-${out}`;
}

export function normaliseCreatorCode(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("CR") ? `CR-${cleaned.slice(2)}` : `CR-${cleaned}`;
}

export type LedgerLine = { amountMinor: number; status: EarningStatus };

/** Confirmed but not yet paid. Pending and reversed lines are not payable. */
export function payableMinor(lines: LedgerLine[]): number {
  return lines
    .filter((line) => line.status === "confirmed")
    .reduce((sum, line) => sum + Math.max(0, line.amountMinor), 0);
}

export function reachedPayoutFloor(minor: number): boolean {
  return minor >= PAYOUT_MINIMUM_MINOR;
}

export type MonthTotals = {
  month: string;
  pendingMinor: number;
  confirmedMinor: number;
  reversedMinor: number;
  paidMinor: number;
};

/** Earnings grouped by calendar month, newest first. No projections, only rows. */
export function byMonth(
  rows: Array<{ createdAt: string; amountMinor: number; status: EarningStatus }>,
): MonthTotals[] {
  const map = new Map<string, MonthTotals>();
  for (const row of rows) {
    const month = row.createdAt.slice(0, 7);
    const entry =
      map.get(month) ??
      ({
        month,
        pendingMinor: 0,
        confirmedMinor: 0,
        reversedMinor: 0,
        paidMinor: 0,
      } satisfies MonthTotals);
    const amount = Math.max(0, row.amountMinor);
    if (row.status === "pending") entry.pendingMinor += amount;
    else if (row.status === "confirmed") entry.confirmedMinor += amount;
    else if (row.status === "reversed") entry.reversedMinor += amount;
    else entry.paidMinor += amount;
    map.set(month, entry);
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}
