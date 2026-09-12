/**
 * Pure idempotency rules for booking. Kept free of database access so the
 * "never charge twice" decision can be tested directly.
 */

/** Payment statuses that mean money already moved for this key. */
const SETTLED = new Set(["settled", "test_settled"]);

/** The one key used for the card's payment, so a retry lands on the same row. */
export function paymentKey(cardId: string): string {
  return `${cardId}-payment`;
}

/** The key for one supplier order line, unique per card and line kind. */
export function orderKey(cardId: string, kind: string): string {
  return `${cardId}-${kind}`;
}

export function isSettled(status: string | null | undefined): boolean {
  return SETTLED.has(status ?? "");
}

/**
 * Should we stop before calling the supplier? True when the card is already
 * booked, or when a payment for this key has settled.
 */
export function shouldStopBeforeSupplier(input: {
  cardStatus: string;
  earlierPaymentStatus?: string | null;
}): boolean {
  return input.cardStatus === "booked" || isSettled(input.earlierPaymentStatus);
}
