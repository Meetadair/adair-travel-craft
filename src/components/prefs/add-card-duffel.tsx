/**
 * Adding a card ahead of time with Duffel Payments. Browser-only: the fields
 * live in the provider's iframe, so the number never reaches our servers.
 */
import { useState } from "react";
import { DuffelCardForm, useDuffelCardFormActions } from "@duffel/components";
import { useServerFn } from "@tanstack/react-start";
import { saveCardToken } from "@/lib/payment.functions";
import { cardFormStyles } from "./card-form-styles";

export default function AddCardDuffel({
  clientKey,
  onSaved,
}: {
  clientKey: string;
  onSaved: () => void;
}) {
  const { ref, saveCard } = useDuffelCardFormActions();
  const persist = useServerFn(saveCardToken);
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <DuffelCardForm
        ref={ref}
        clientKey={clientKey}
        intent="to-save-card"
        styles={cardFormStyles}
        onValidateSuccess={() => {
          setValid(true);
          setProblem(null);
        }}
        onValidateFailure={() => setValid(false)}
        onSaveCardSuccess={(card) => {
          void persist({
            data: {
              providerCardId: card.id,
              brand: card.brand,
              last4: card.last_4_digits,
            },
          })
            .then(() => {
              setBusy(false);
              onSaved();
            })
            .catch(() => {
              setBusy(false);
              setProblem("We could not save that card. Please try again.");
            });
        }}
        onSaveCardFailure={() => {
          setBusy(false);
          setProblem("Those card details were not accepted. Please check them and try again.");
        }}
      />
      {problem && <p className="text-sm text-primary">{problem}</p>}
      <button
        type="button"
        disabled={!valid || busy}
        onClick={() => {
          setProblem(null);
          setBusy(true);
          saveCard();
        }}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save card"}
      </button>
    </div>
  );
}
