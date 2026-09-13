/**
 * Stripe checkout — inactive until Stripe is switched on in the admin panel and
 * its keys are configured. Browser-only: card fields and wallet sheets live in
 * Stripe's own iframes, so nothing sensitive reaches our backend.
 *
 * Apple Pay and Google Pay come from the Payment Element and appear only on
 * devices that actually support them, so no wallet button is ever shown that
 * cannot complete a payment.
 */
import { useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AlertTriangle, Lock } from "lucide-react";
import type { PaymentSession } from "@/lib/payment.functions";
import type { AuthorisedPayment } from "./card-payment";
import { eur } from "@/lib/trip/client";

function Inner({
  session,
  amountEur,
  disabled,
  payingLabel,
  onAuthorised,
}: {
  session: PaymentSession;
  amountEur: number;
  disabled?: boolean;
  payingLabel?: string | null;
  /** Stripe's Payment Element manages saved cards itself. */
  preselectCardId?: string | undefined;
  onAuthorised: (payment: AuthorisedPayment) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements || !session.clientSecret) return;
    setBusy(true);
    setProblem(null);
    // Authorise only; the amount is captured once the trip is confirmed.
    const result = await stripe.confirmPayment({
      elements,
      clientSecret: session.clientSecret,
      redirect: "if_required",
    });
    setBusy(false);
    if (result.error) {
      setProblem(
        result.error.message ?? "That payment was declined. Try another card or another method.",
      );
      return;
    }
    const intent = result.paymentIntent;
    const wallet = (
      intent as unknown as {
        payment_method?: { card?: { wallet?: { type?: string } } };
      }
    ).payment_method?.card?.wallet?.type;
    const paymentMethodId =
      typeof intent?.payment_method === "string"
        ? intent.payment_method
        : (intent?.payment_method?.id ?? "");
    void wallet;
    onAuthorised({
      providerCardId: paymentMethodId,
      threeDSecureSessionId: intent?.id ?? "",
      brand: null,
      last4: null,
      method: "card",
    });
  };

  return (
    <div className="space-y-4">
      {session.testMode && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
          Test mode — no real charge.
        </p>
      )}
      <PaymentElement options={{ layout: "tabs" }} />
      {problem && (
        <p className="flex items-start gap-2 text-sm text-primary">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {problem}
        </p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={disabled || busy || !stripe}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <Lock className="size-4" />
        {busy ? "Authorising…" : (payingLabel ?? `Pay ${eur(amountEur)}`)}
      </button>
      <p className="text-xs text-muted-foreground">
        Paid to Adair, which then pays each supplier.
      </p>
    </div>
  );
}

export default function StripePayment(props: {
  session: PaymentSession;
  amountEur: number;
  disabled?: boolean;
  payingLabel?: string | null;
  onAuthorised: (payment: AuthorisedPayment) => void;
}) {
  const { session } = props;
  const stripePromise = useMemo(
    () => (session.publishableKey ? loadStripe(session.publishableKey) : null),
    [session.publishableKey],
  );

  if (!stripePromise || !session.clientSecret) {
    return (
      <p className="text-sm text-muted-foreground">
        Card payments are not switched on yet. Nothing was charged.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: session.clientSecret }}>
      <Inner {...props} />
    </Elements>
  );
}
