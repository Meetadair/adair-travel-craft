/**
 * How flexible a fare is, said plainly and always.
 *
 * Duffel returns this on every offer — `change_before_departure` and
 * `refund_before_departure`, each with whether it is allowed and what the
 * airline keeps. We have been parsing it since the beginning and using it only
 * to explain why one fare beat another. A traveller comparing two flights
 * cannot see whether either can be moved.
 *
 * It is worth showing because it is frequently the deciding fact and rarely
 * the obvious one. On a real Warsaw–London search: British Airways at €160.97
 * changeable for €60, Lufthansa at €204.48 changeable for €200. The cheaper
 * fare was also the more flexible one, and nothing on screen said so.
 *
 * The penalty matters as much as the permission: "changeable" alone is not
 * the truth, "changeable, airline keeps €200" is.
 */

export type FareConditions = {
  // Optional as well as nullable: a flight result carries these only when the
  // airline stated them, and an absent field means the same as a null one —
  // we were told nothing.
  changeable?: boolean | null | undefined;
  refundable?: boolean | null | undefined;
  changePenaltyEur?: number | null | undefined;
  refundPenaltyEur?: number | null | undefined;
};

export type Flexibility = {
  /** One short phrase for a badge. Null when the airline stated nothing. */
  label: string | null;
  /** Free, penalised, fixed, or simply unknown — for colour, not for wording. */
  tone: "free" | "penalty" | "fixed" | "unknown";
  /** The fuller sentence, for the detail line under an option. */
  detail: string | null;
};

const money = (amount: number): string =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * An airline that states nothing gets nothing said about it. Guessing
 * "non-refundable" from silence would be a claim we cannot support, and a
 * traveller who acts on it loses money.
 */
export function flexibilityOf(conditions: FareConditions): Flexibility {
  const { changeable, refundable, changePenaltyEur, refundPenaltyEur } = conditions;

  if (changeable == null && refundable == null) {
    return { label: null, tone: "unknown", detail: null };
  }

  const parts: string[] = [];
  if (refundable === true) {
    parts.push(refundPenaltyEur ? `refundable, ${money(refundPenaltyEur)} fee` : "fully refundable");
  } else if (refundable === false) {
    parts.push("non-refundable");
  }
  if (changeable === true) {
    parts.push(changePenaltyEur ? `changeable, ${money(changePenaltyEur)} fee` : "free changes");
  } else if (changeable === false) {
    parts.push("no changes");
  }

  const detail = parts.length ? `${parts.join(" · ")}` : null;

  // The badge leads with the best news a traveller can act on.
  if (refundable === true && !refundPenaltyEur) {
    return { label: "Fully refundable", tone: "free", detail };
  }
  if (changeable === true && !changePenaltyEur) {
    return { label: "Free changes", tone: "free", detail };
  }
  if (changeable === true) {
    return { label: `Changeable · ${money(changePenaltyEur ?? 0)}`, tone: "penalty", detail };
  }
  if (refundable === true) {
    return { label: `Refundable · ${money(refundPenaltyEur ?? 0)}`, tone: "penalty", detail };
  }
  return { label: "Fixed dates", tone: "fixed", detail };
}

/** Can this booking be moved at all? Drives whether we offer to change it. */
export function isChangeable(conditions: FareConditions): boolean {
  return conditions.changeable === true;
}

/** What moving it costs before any fare difference. */
export function changeFeeEur(conditions: FareConditions): number {
  return conditions.changeable === true ? (conditions.changePenaltyEur ?? 0) : 0;
}
