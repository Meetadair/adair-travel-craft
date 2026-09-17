/**
 * Budgets, and the block.
 *
 * This is the control the whole finance conversation turns on, so it is worth
 * being exact about it:
 *
 *   - Over the limit, the booking stops. Nothing is reserved, no card is
 *     charged.
 *   - It is released by exactly one named person — not by any administrator
 *     who happens to be logged in, and not by us.
 *   - Every release records who, how much, and why, and is reported separately
 *     as authorised overspend, because the point of the number is that somebody
 *     had to decide.
 *
 * Budgets nest: a trip consumes the person's budget and their cost centre's at
 * the same time, and either running out is enough to stop it.
 */

export type BudgetScope = "person" | "team" | "cost_centre" | "project" | "client";
export type BudgetPeriod = "month" | "quarter" | "year" | "rolling_12";

export type Budget = {
  id: string;
  name: string;
  scope: BudgetScope;
  period: BudgetPeriod;
  limitMinor: number;
  spentMinor: number;
  /** Committed but not yet invoiced — a booked trip that has not travelled. */
  committedMinor: number;
  currency: string;
  /**
   * The one person who may release a blocked booking. A budget without one
   * cannot be saved: a block nobody can release is worse than no block.
   */
  releaseAuthorityId: string;
  releaseAuthorityName: string;
  /** May act only after the authority has been silent this long. Optional. */
  deputyId?: string | undefined;
  deputyAfterHours?: number | undefined;
  /** Spend on this budget is re-invoiced to a client and is not our cost. */
  rebillable?: boolean | undefined;
};

/** 80% is a quiet note, 100% needs approving, past the limit is a hard stop. */
export const NOTIFY_AT = 0.8;
export const APPROVE_AT = 1.0;

export type BudgetState = "ok" | "notify" | "approve" | "blocked";

export function usedMinor(budget: Budget): number {
  return budget.spentMinor + budget.committedMinor;
}

export function remainingMinor(budget: Budget): number {
  return budget.limitMinor - usedMinor(budget);
}

/** 0 when there is no limit to be a fraction of, never a division by zero. */
export function usedFraction(budget: Budget): number {
  if (budget.limitMinor <= 0) return 0;
  return usedMinor(budget) / budget.limitMinor;
}

/** Where a budget stands right now, before anything new is added to it. */
export function stateOf(budget: Budget): BudgetState {
  const used = usedFraction(budget);
  if (used > APPROVE_AT) return "blocked";
  if (used >= APPROVE_AT) return "approve";
  if (used >= NOTIFY_AT) return "notify";
  return "ok";
}

export type BookingDecision = {
  state: BudgetState;
  /** The budget that decided it — the tightest one, not the first. */
  decidedBy: Budget | null;
  /** How far past the limit this booking would go. 0 unless blocked. */
  shortfallMinor: number;
  remainingMinor: number;
  /** Who must release it. Null unless blocked. */
  releaseAuthorityName: string | null;
};

/**
 * What happens if this person books this amount right now.
 *
 * Every budget the trip touches is asked, and the strictest answer wins — a
 * personal budget with room left does not rescue a cost centre that is out of
 * money. Rebillable budgets are checked too, but a client-funded trip that
 * fits its own budget is not stopped by an internal one.
 */
export function decide(amountMinor: number, budgets: Budget[]): BookingDecision {
  const applicable = budgets.filter((b) => b.limitMinor > 0);
  if (applicable.length === 0) {
    return {
      state: "ok",
      decidedBy: null,
      shortfallMinor: 0,
      remainingMinor: 0,
      releaseAuthorityName: null,
    };
  }

  const severity: Record<BudgetState, number> = { ok: 0, notify: 1, approve: 2, blocked: 3 };
  let worst: { budget: Budget; state: BudgetState; after: number } | null = null;

  for (const budget of applicable) {
    const after = usedMinor(budget) + amountMinor;
    const fraction = after / budget.limitMinor;
    const state: BudgetState =
      fraction > APPROVE_AT
        ? "blocked"
        : fraction >= APPROVE_AT
          ? "approve"
          : fraction >= NOTIFY_AT
            ? "notify"
            : "ok";
    if (
      !worst ||
      severity[state] > severity[worst.state] ||
      // Same severity: the one with least room left is the one to name.
      (severity[state] === severity[worst.state] &&
        budget.limitMinor - after < worst.budget.limitMinor - worst.after)
    ) {
      worst = { budget, state, after };
    }
  }

  const { budget, state, after } = worst!;
  return {
    state,
    decidedBy: budget,
    shortfallMinor: state === "blocked" ? after - budget.limitMinor : 0,
    remainingMinor: Math.max(0, budget.limitMinor - usedMinor(budget)),
    releaseAuthorityName: state === "blocked" ? budget.releaseAuthorityName : null,
  };
}

/**
 * Whether this person may release this blocked booking. The deputy is not a
 * second authority — they may act only once the authority has been unreachable
 * for the agreed number of hours.
 */
export function mayRelease(budget: Budget, personId: string, hoursSinceRequested: number): boolean {
  if (personId === budget.releaseAuthorityId) return true;
  if (!budget.deputyId || personId !== budget.deputyId) return false;
  const after = budget.deputyAfterHours ?? 0;
  return after > 0 && hoursSinceRequested >= after;
}

export type Release = {
  budgetId: string;
  releasedById: string;
  amountMinor: number;
  reason: string;
  /** One booking only, or the limit itself was raised. */
  kind: "once" | "raised_limit";
  at: string;
};

/**
 * Authorised overspend, which is reported on its own and never folded into
 * ordinary spend. A CFO reading the pack has to be able to see every one of
 * these and who decided it.
 */
export function authorisedOverspendMinor(releases: Release[]): number {
  return releases.reduce((sum, r) => sum + Math.max(0, r.amountMinor), 0);
}

/** A release with no reason is not a record of a decision. */
export function isValidRelease(release: Pick<Release, "reason" | "amountMinor">): boolean {
  return release.reason.trim().length >= 3 && release.amountMinor > 0;
}
