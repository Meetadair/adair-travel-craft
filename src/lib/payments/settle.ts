/**
 * How much of the authorisation to actually take.
 *
 * Until now nothing took it. The card was authorised for the whole trip with
 * `capture_method: "manual"`, the airline was paid directly at Duffel with the
 * traveller's card, and the rest — our margin, the hotel, the car, the extras —
 * went onto the total, the confirmation and the VAT invoice and was collected
 * from nobody. The hold expired a few days later and the money went home.
 *
 * Two settlement models, two answers:
 *
 * - merchant-of-record (Stripe): we are the one taking the money. Whatever the
 *   supplier already took straight off the traveller's card is deducted, and we
 *   capture the remainder. Paying the airline from our own Duffel balance
 *   instead means nothing was taken yet, so we capture the lot.
 * - supplier-of-record (Duffel Payments): the supplier settles with the
 *   traveller and there is no separate authorisation of ours to capture.
 *
 * Credit the traveller has already spent is money we hold, not money to charge
 * again, so it comes off the top.
 */
import type { SettlementModel } from "@/lib/payments/types";

export type SettlementPlan = {
  /** What to capture, in minor units. Zero means release the hold instead. */
  captureMinor: number;
  /** Why, in one line, for the payment row and the audit log. */
  note: string;
};

export function settlementFor(input: {
  /** Everything actually bought, traveller-facing, in EUR. */
  confirmedTotalEur: number;
  /** Store credit already spent on this trip, in minor units. */
  creditAppliedMinor: number;
  /** What a supplier already charged this card directly, in EUR. */
  paidAtSupplierEur: number;
  settlementModel: SettlementModel;
}): SettlementPlan {
  const { confirmedTotalEur, creditAppliedMinor, paidAtSupplierEur, settlementModel } = input;

  if (settlementModel === "supplier-of-record") {
    return { captureMinor: 0, note: "supplier settles with the traveller directly" };
  }

  const totalMinor = Math.round(confirmedTotalEur * 100);
  const supplierMinor = Math.max(0, Math.round(paidAtSupplierEur * 100));
  const credit = Math.max(0, creditAppliedMinor);
  const captureMinor = Math.max(0, totalMinor - supplierMinor - credit);

  if (captureMinor === 0) {
    return {
      captureMinor: 0,
      note: supplierMinor > 0 ? "supplier took the full amount" : "covered by credit",
    };
  }
  return {
    captureMinor,
    note:
      supplierMinor > 0
        ? "remainder after the amount the supplier charged this card"
        : "full trip amount",
  };
}
