/**
 * Duffel Payments adapter.
 *
 * Duffel is the supplier of record: the card is collected in Duffel's hosted
 * browser component and the airline is paid by Duffel, so no card data and no
 * customer funds pass through us. Duffel Cards offers card only — no Apple Pay
 * and no Google Pay — so `supportedMethods()` reports just `card`.
 *
 * Duffel has no standalone intent object; the "intent" here is our own record
 * keyed by the idempotency key, and the actual charge happens when the order is
 * created with the card token. `capture`, `refund` and friends therefore report
 * `not-supported` rather than pretending.
 */
import {
  paymentOk,
  paymentUnavailable,
  type IntentMetadata,
  type PaymentAdapter,
  type PaymentIntent,
  type PaymentOutcome,
  type PaymentResult,
} from "./types";

const PROVIDER = "duffel";

function secret(): string | null {
  return process.env["DUFFEL_API_KEY"] ?? null;
}

function outcome(intentRef: string, note: string): PaymentOutcome {
  return {
    provider: PROVIDER,
    intentRef,
    status: "failed",
    method: null,
    cardBrand: null,
    cardLast4: null,
    threeDsStatus: null,
    settlementModel: "supplier-of-record",
    amountMinor: 0,
    currency: "EUR",
    failureNote: note,
  };
}

export const duffelPayments: PaymentAdapter = {
  id: PROVIDER,
  label: "Duffel Payments",
  settlementModel: "supplier-of-record",

  isConfigured: () => Boolean(secret()),
  isTestMode: () => (secret() ?? "").startsWith("duffel_test_"),
  supportedMethods: () => ["card"],

  async createIntent(
    amountMinor: number,
    currency: string,
    idempotencyKey: string,
    _metadata?: IntentMetadata,
  ): Promise<PaymentResult<PaymentIntent>> {
    void _metadata;
    if (!secret()) return paymentUnavailable("missing-key");
    let clientKey: string | null = null;
    try {
      const { createComponentClientKey } = await import("@/lib/trip/duffel-cards.server");
      clientKey = await createComponentClientKey();
    } catch (error) {
      const note = error instanceof Error ? error.message : "unknown";
      console.error(`Duffel component key failed: ${note}`);
      return paymentUnavailable("rejected", note);
    }
    return paymentOk({
      provider: PROVIDER,
      intentRef: idempotencyKey,
      amountMinor,
      currency,
      status: "requires_payment_method",
      settlementModel: "supplier-of-record",
      idempotencyKey,
      testMode: duffelPayments.isTestMode(),
      client: { clientKey, publishableKey: null, clientSecret: null },
    });
  },

  /**
   * The card is authorised inside Duffel's component (including 3-D Secure) and
   * charged when the order is created, so there is nothing to confirm here.
   */
  async confirm(intentRef) {
    return paymentUnavailable("not-supported", `confirmed with the order (${intentRef})`);
  },
  async capture(intentRef) {
    return paymentUnavailable("not-supported", `captured with the order (${intentRef})`);
  },
  async cancel(intentRef) {
    return paymentUnavailable("not-supported", `cancel the order instead (${intentRef})`);
  },
  async refund(intentRef) {
    return paymentUnavailable("not-supported", `refunds follow the order (${intentRef})`);
  },
  async getStatus(intentRef) {
    if (!secret()) return paymentUnavailable("missing-key");
    // Duffel exposes no intent resource; the order record is the source of truth.
    return paymentOk({ ...outcome(intentRef, "status lives on the order"), status: "authorised" });
  },
};
