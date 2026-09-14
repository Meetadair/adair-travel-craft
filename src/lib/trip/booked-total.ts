/**
 * What the traveller actually owes.
 *
 * A booked trip's lines are not all purchases. A line is "requested" when we
 * recorded that the traveller wants it but nothing was bought — a hotel whose
 * supplier product is not enabled on our account, a hire car no provider sells
 * through an API yet, an airport transfer with no connected provider. Those
 * lines have no reference, no supplier order and no cancellation right,
 * because there is nothing to cancel.
 *
 * The total used to exclude only failed lines, so a sample hotel carried its
 * full price into the amount on the confirmation. The traveller would have
 * been told they owed money for a room that was never booked and never would
 * be.
 *
 * Only a line with a supplier order behind it is money.
 */

export type BookingLine = {
  kind: string;
  status: string;
  amountEur: number;
};

/** A line somebody actually sold us. */
export function isPurchased(status: string): boolean {
  return status === "confirmed" || status === "booked";
}

/** Recorded as wanted, not bought. Shown to the traveller, never charged. */
export function isRequestedOnly(status: string): boolean {
  return status === "requested" || status === "pending-supplier";
}

/** The money. Requested and failed lines are not part of it. */
export function chargeableTotalEur(lines: BookingLine[]): number {
  const total = lines
    .filter((line) => isPurchased(line.status))
    .reduce((sum, line) => sum + (Number.isFinite(line.amountEur) ? line.amountEur : 0), 0);
  return Math.round(total * 100) / 100;
}

/** What we could not buy, so the confirmation can say so plainly. */
export function notBookedLines(lines: BookingLine[]): BookingLine[] {
  return lines.filter((line) => isRequestedOnly(line.status));
}
