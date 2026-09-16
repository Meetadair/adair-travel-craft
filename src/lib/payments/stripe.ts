/**
 * Stripe adapter — built, but inactive until its row in `payment_providers` is
 * switched on and STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY are configured.
 *
 * With Stripe we become the merchant of record: the customer pays us, and we
 * pay the supplier from our own balance. That distinction is reported on every
 * intent and outcome so the payment record and the admin panel show it.
 *
 * Apple Pay and Google Pay come from the Payment Element automatically, so both
 * are reported as supported alongside card.
 */
import {
  paymentOk,
  paymentUnavailable,
  type IntentMetadata,
  type IntentStatus,
  type PaymentAdapter,
  type PaymentIntent,
  type PaymentMethodKind,
  type PaymentOutcome,
  type PaymentResult,
} from "./types";

const PROVIDER = "stripe";
const BASE = "https://api.stripe.com/v1";

function secret(): string | null {
  return process.env["STRIPE_SECRET_KEY"] ?? null;
}

function publishable(): string | null {
  return process.env["STRIPE_PUBLISHABLE_KEY"] ?? null;
}

type StripeIntent = {
  id?: string;
  status?: string;
  amount?: number;
  amount_received?: number;
  currency?: string;
  client_secret?: string;
  last_payment_error?: { message?: string };
  charges?: {
    data?: Array<{
      payment_method_details?: {
        type?: string;
        card?: {
          brand?: string;
          last4?: string;
          wallet?: { type?: string };
          three_d_secure?: { result?: string };
        };
      };
    }>;
  };
};

/** Stripe's own status vocabulary mapped onto the shared one. */
function mapStatus(status: string | undefined): IntentStatus {
  switch (status) {
    case "requires_payment_method":
      return "requires_payment_method";
    case "requires_action":
    case "requires_confirmation":
return "requires_action";
    case "requires_capture":
      return "authorised";
    case "succeeded":
      return "captured";
    case "canceled":
      return "cancelled";
    default:
      return "failed";
  }
}

function walletMethod(intent: StripeIntent): PaymentMethodKind | null {
  const details = intent.charges?.data?.[0]?.payment_method_details;
  if (!details) return null;
  const wallet = details.card?.wallet?.type;
  if (wallet === "apple_pay") return "apple-pay";
  if (wallet === "google_pay") return "google-pay";
  return details.type === "card" ? "card" : null;
}

/** Stripe's API is form-encoded; nested keys use bracket notation. */
function form(fields: Record<string, string | number | undefined | null>): string {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    body.set(key, String(value));
  }
  return body.toString();
}

async function call(
  path: string,
  body: string,
  idempotencyKey?: string,
): Promise<PaymentResult<StripeIntent>> {
  const key = secret();
  if (!key) return paymentUnavailable("missing-key");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers,
    ...(body ? { body } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Stripe ${path} failed [${res.status}]: ${text.slice(0, 300)}`);
    let note = `stripe-${res.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) note = parsed.error.message;
    } catch {
      /* keep the status-based note */
    }
    return paymentUnavailable("rejected", note);
  }
  return paymentOk(JSON.parse(text) as StripeIntent);
}

function toOutcome(intent: StripeIntent, fallbackRef: string): PaymentOutcome {
  const card = intent.charges?.data?.[0]?.payment_method_details?.card;
  return {
    provider: PROVIDER,
    intentRef: intent.id ?? fallbackRef,
    status: mapStatus(intent.status),
    method: walletMethod(intent),
    cardBrand: card?.brand ?? null,
    cardLast4: card?.last4 ?? null,
    threeDsStatus: card?.three_d_secure?.result ?? null,
    settlementModel: "merchant-of-record",
    amountMinor: intent.amount_received ?? intent.amount ?? 0,
    currency: (intent.currency ?? "eur").toUpperCase(),
    failureNote: intent.last_payment_error?.message ?? null,
  };
}

export const stripePayments: PaymentAdapter = {
  id: PROVIDER,
  label: "Stripe",
  settlementModel: "merchant-of-record",

  isConfigured: () => Boolean(secret() && publishable()),
  isTestMode: () => (secret() ?? "").startsWith("sk_test_"),
  supportedMethods: () => ["card", "apple-pay", "google-pay"],

  async vaultSession(customerRef) {
    // A setup intent stores the card with Stripe without charging anything.
    const res = await call(
      "/setup_intents",
      form({ usage: "off_session", "metadata[user_id]": customerRef }),
    );
    if (res.status !== "ok") return res;
    return paymentOk({
      provider: PROVIDER,
      clientKey: null,
      publishableKey: publishable(),
      clientSecret: (res.data as { client_secret?: string }).client_secret ?? null,
      testMode: stripePayments.isTestMode(),
    });
  },

  async createIntent(amountMinor, currency, idempotencyKey, metadata?: IntentMetadata) {
    const fields: Record<string, string | number> = {
      amount: amountMinor,
      currency: currency.toLowerCase(),
      "automatic_payment_methods[enabled]": "true",
      capture_method: "manual",
    };
    for (const [key, value] of Object.entries(metadata ?? {})) {
      if (value !== null) fields[`metadata[${key}]`] = value;
    }
    const res = await call("/payment_intents", form(fields), idempotencyKey);
    if (res.status !== "ok") return res;
    const intent = res.data;
    if (!intent.id) return paymentUnavailable("rejected", "no intent id");
    return paymentOk({
      provider: PROVIDER,
      intentRef: intent.id,
      amountMinor,
      currency: currency.toUpperCase(),
      status: mapStatus(intent.status),
      settlementModel: "merchant-of-record",
      idempotencyKey,
      testMode: stripePayments.isTestMode(),
      client: {
        clientKey: null,
        publishableKey: publishable(),
        clientSecret: intent.client_secret ?? null,
      },
    });
  },

  async confirm(intentRef) {
    const res = await call(`/payment_intents/${intentRef}/confirm`, form({}));
    return res.status === "ok" ? paymentOk(toOutcome(res.data, intentRef)) : res;
  },

  async capture(intentRef, amountMinor) {
    // Capturing less than the authorisation releases the difference, which is
    // what a trip costing less than the hold should do to the traveller's card.
    const res = await call(
      `/payment_intents/${intentRef}/capture`,
      form(amountMinor === undefined ? {} : { amount_to_capture: amountMinor }),
      `${intentRef}-capture-${amountMinor ?? "full"}`,
    );
    return res.status === "ok" ? paymentOk(toOutcome(res.data, intentRef)) : res;
  },

  async cancel(intentRef) {
    const res = await call(`/payment_intents/${intentRef}/cancel`, form({}));
    return res.status === "ok" ? paymentOk(toOutcome(res.data, intentRef)) : res;
  },

  async refund(intentRef, amountMinor, reason) {
    const allowed = new Set(["duplicate", "fraudulent", "requested_by_customer"]);
    const res = await call(
      "/refunds",
      form({
        payment_intent: intentRef,
        amount: amountMinor,
        reason: reason && allowed.has(reason) ? reason : undefined,
        "metadata[note]": reason ?? undefined,
      }),
      `${intentRef}-refund-${amountMinor}`,
    );
    if (res.status !== "ok") return res;
    const status = await stripePayments.getStatus(intentRef);
    if (status.status !== "ok") return status;
    return paymentOk({ ...status.data, status: "refunded" });
  },

  async getStatus(intentRef) {
    const res = await call(`/payment_intents/${intentRef}?expand[]=charges`, "");
    return res.status === "ok" ? paymentOk(toOutcome(res.data, intentRef)) : res;
  },
};
