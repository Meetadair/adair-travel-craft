/**
 * Adding a card ahead of time with Stripe. The card is stored against a setup
 * intent — nothing is charged — and only the resulting token reaches us.
 */
import { useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { saveCardToken } from "@/lib/payment.functions";
import { stripeAppearance } from "../stripe-appearance";
import { useTheme } from "@/lib/theme";

function Inner({ clientSecret, onSaved }: { clientSecret: string; onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const persist = useServerFn(saveCardToken);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setProblem(null);
    const result = await stripe.confirmSetup({ elements, clientSecret, redirect: "if_required" });
    if (result.error) {
      setBusy(false);
      setProblem(result.error.message ?? "That card was not accepted. Please try another one.");
      return;
    }
    const method = result.setupIntent?.payment_method;
    const id = typeof method === "string" ? method : (method?.id ?? "");
    if (!id) {
      setBusy(false);
      setProblem("We could not save that card. Please try again.");
      return;
    }
    try {
      await persist({ data: { providerCardId: id, brand: null, last4: null } });
      onSaved();
    } catch {
      setProblem("We could not save that card. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <PaymentElement options={{ layout: "tabs" }} />
      {problem && <p className="text-sm text-primary">{problem}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </div>
  );
}

export default function AddCardStripe({
  publishableKey,
  clientSecret,
  onSaved,
}: {
  publishableKey: string;
  clientSecret: string;
  onSaved: () => void;
}) {
  const { resolved } = useTheme();
  const promise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={promise} options={{ clientSecret, appearance: stripeAppearance(resolved) }}>
      <Inner clientSecret={clientSecret} onSaved={onSaved} />
    </Elements>
  );
}
