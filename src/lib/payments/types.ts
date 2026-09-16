/**
 * One shared shape for every payment provider, so the booking flow never
 * touches a provider SDK. Adding or switching a provider means editing only
 * that provider's adapter file plus a row in `payment_providers`.
 */

export type PaymentMethodKind = "card" | "apple-pay" | "google-pay";

/**
 * Who takes the customer's money:
 * - `supplier-of-record`: the supplier charges the card, we never hold funds.
 * - `merchant-of-record`: we collect from the customer and pay the supplier
 *   from our own balance.
 */
export type SettlementModel = "supplier-of-record" | "merchant-of-record";

export type PaymentUnavailableReason =
  /** No credential for this provider in the environment. */
  | "missing-key"
  /** Switched off in `payment_providers`. */
  | "disabled"
  /** Nothing enabled at all. */
  | "no-provider"
  /** Key present, but this operation is not wired for this provider yet. */
  | "not-supported"
  /** Provider answered with a refusal. */
  | "rejected";

export type PaymentUnavailable = {
  status: "unavailable";
  reason: PaymentUnavailableReason;
  note?: string | undefined;
};
export type PaymentOk<T> = { status: "ok"; data: T };
export type PaymentResult<T> = PaymentOk<T> | PaymentUnavailable;

export const paymentOk = <T,>(data: T): PaymentOk<T> => ({ status: "ok", data });
export const paymentUnavailable = (
  reason: PaymentUnavailableReason,
  note?: string,
): PaymentUnavailable => ({ status: "unavailable", reason, note });

export type IntentStatus =
  | "requires_payment_method"
  | "requires_action"
  | "authorised"
  | "captured"
  | "cancelled"
  | "refunded"
  | "failed";

/** What the browser needs to collect the payment for this intent. */
export type IntentClientConfig = {
  /** Short-lived key for the provider's browser component. */
  clientKey: string | null;
  /** Publishable key, when the provider's browser SDK needs one. */
  publishableKey?: string | null;
  /** Provider-specific handle the browser component confirms against. */
  clientSecret?: string | null;
};

export type PaymentIntent = {
  provider: string;
  /** Reference every later call uses. */
  intentRef: string;
  amountMinor: number;
  currency: string;
  status: IntentStatus;
  settlementModel: SettlementModel;
  idempotencyKey: string;
  testMode: boolean;
  client: IntentClientConfig;
};

export type PaymentOutcome = {
  provider: string;
  intentRef: string;
  status: IntentStatus;
  /** How the customer paid, once known. */
  method: PaymentMethodKind | null;
  cardBrand: string | null;
  cardLast4: string | null;
  threeDsStatus: string | null;
  settlementModel: SettlementModel;
  amountMinor: number;
  currency: string;
  failureNote: string | null;
};

/**
 * What the browser needs to store a card for later, with no payment attached.
 * Providers that cannot vault a card outside checkout report `not-supported`.
 */
export type VaultSession = {
  provider: string;
  clientKey: string | null;
  publishableKey: string | null;
  clientSecret: string | null;
  testMode: boolean;
};

export type IntentMetadata = Record<string, string | number | null>;

export type PaymentAdapter = {
  id: string;
  label: string;
  settlementModel: SettlementModel;
  /** False when the provider's secret is missing from the environment. */
  isConfigured(): boolean;
  /** True while the provider's test credentials are in use. */
  isTestMode(): boolean;
  /** Which methods this provider can really offer — never a guess. */
  supportedMethods(): PaymentMethodKind[];

  /**
   * Opens a hosted form session for adding a card ahead of any booking, so
   * Settings never touches a provider SDK decision of its own.
   */
  vaultSession(customerRef: string): Promise<PaymentResult<VaultSession>>;

  createIntent(
    amountMinor: number,
    currency: string,
    idempotencyKey: string,
    metadata?: IntentMetadata,
  ): Promise<PaymentResult<PaymentIntent>>;
  confirm(intentRef: string): Promise<PaymentResult<PaymentOutcome>>;
  /**
   * Takes the money. `amountMinor` captures part of the authorisation — the
   * trip total less whatever a supplier already charged this card — and the
   * rest of the hold is released. Omitted, it takes the whole authorisation.
   */
  capture(intentRef: string, amountMinor?: number): Promise<PaymentResult<PaymentOutcome>>;
  cancel(intentRef: string): Promise<PaymentResult<PaymentOutcome>>;
  refund(
    intentRef: string,
    amountMinor: number,
    reason?: string,
  ): Promise<PaymentResult<PaymentOutcome>>;
  getStatus(intentRef: string): Promise<PaymentResult<PaymentOutcome>>;
};
