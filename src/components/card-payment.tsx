/**
 * Duffel hosted card form + 3-D Secure. Browser-only: the card fields live in
 * Duffel's iframe, so no card number, expiry or security code ever reaches us.
 */
import { useState } from "react";
import {
  DuffelCardForm,
  useDuffelCardFormActions,
  createThreeDSecureSession,
} from "@duffel/components";
import { useServerFn } from "@tanstack/react-start";
import { Lock, AlertTriangle } from "lucide-react";
import { saveCardToken, type PaymentSession } from "@/lib/payment.functions";
import { eur } from "@/lib/trip/client";

export type AuthorisedPayment = {
  providerCardId: string;
  threeDSecureSessionId: string;
  brand: string | null;
  last4: string | null;
  method: "card" | "saved-card";
};

type Stage = "idle" | "tokenising" | "authorising" | "challenge" | "declined" | "authorised";

const formStyles = {
  input: {
    default: {
      "background-color": "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.12)",
      "border-radius": "12px",
      padding: "10px 14px",
      "font-family": "'Plus Jakarta Sans', sans-serif",
      "font-size": "14px",
      color: "#1B1A17",
    },
    focus: { border: "1px solid #E8623F", outline: "none" },
  },
  select: {
    default: {
      "background-color": "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.12)",
      "border-radius": "12px",
      padding: "10px 14px",
      "font-family": "'Plus Jakarta Sans', sans-serif",
      "font-size": "14px",
    },
  },
  label: {
    "font-family": "'Plus Jakarta Sans', sans-serif",
    "font-size": "12px",
    color: "rgba(27,26,23,0.62)",
  },
  inputErrorMessage: { "font-size": "12px", color: "#E8623F" },
  sectionTitle: { "font-family": "'Bricolage Grotesque', sans-serif", "font-size": "15px" },
};

export default function CardPayment({
  session,
  amountEur,
  disabled,
  onAuthorised,
  payingLabel,
  preselectCardId,
}: {
  session: PaymentSession;
  amountEur: number;
  disabled?: boolean;
  payingLabel?: string | null;
  preselectCardId?: string | undefined;
  onAuthorised: (payment: AuthorisedPayment) => void;
}) {
  const { ref, saveCard, createCardForTemporaryUse } = useDuffelCardFormActions();
  const persistCard = useServerFn(saveCardToken);

  // The default saved card is pre-selected; "Use a different card" is always there.
  const [selected, setSelected] = useState<string>(
    preselectCardId ?? session.savedCards.find((card) => card.isDefault)?.id ?? "new",
  );
  const [saveForNextTime, setSaveForNextTime] = useState(false);
  const [valid, setValid] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [problem, setProblem] = useState<string | null>(null);

  const savedCard = session.savedCards.find((c) => c.id === selected) ?? null;
  const intent = savedCard ? "to-use-saved-card" : "to-create-card-for-temporary-use";

  if (!session.clientKey) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border p-4">
        <AlertTriangle className="mt-0.5 size-4 text-primary" />
        <p className="text-sm text-muted-foreground">
          {session.unavailable === "supplier-not-configured"
            ? "Card payment is not switched on yet, so nothing can be charged."
            : "We could not open the secure card form. Please try again in a moment."}
        </p>
      </div>
    );
  }

  async function authorise(cardId: string, brand: string | null, last4: string | null) {
    if (!session.offerId) {
      // Nothing card-payable on this trip: hand the card straight back.
      onAuthorised({
        providerCardId: cardId,
        threeDSecureSessionId: "",
        brand,
        last4,
        method: savedCard ? "saved-card" : "card",
      });
      return;
    }
    setStage("authorising");
    try {
      const dsSession = await createThreeDSecureSession(
        session.clientKey!,
        cardId,
        session.offerId,
        [],
        true,
      );
      if (dsSession.status === "ready_for_payment") {
        setStage("authorised");
        onAuthorised({
          providerCardId: cardId,
          threeDSecureSessionId: dsSession.id,
          brand,
          last4,
          method: savedCard ? "saved-card" : "card",
        });
        return;
      }
      setStage("declined");
      setProblem(
        "Your bank did not approve this card. Try another card, or check with your bank and try again.",
      );
    } catch (error) {
      console.error("3DS session failed", error);
      setStage("declined");
      setProblem("We could not confirm this card with your bank. Nothing was charged.");
    }
  }

  const busy = stage === "tokenising" || stage === "authorising" || stage === "challenge";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Payment</h2>
        <span className="text-sm font-semibold text-primary">{eur(amountEur)}</span>
      </div>
      {session.testMode && (
        <span className="inline-block rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Test mode — no real charge
        </span>
      )}

      {session.savedCards.length > 0 && (
        <div className="space-y-2">
          {session.savedCards.map((card) => (
            <label key={card.id} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="payment-card"
                className="accent-primary"
                checked={selected === card.id}
                onChange={() => {
                  setSelected(card.id);
                  setValid(false);
                  setProblem(null);
                  setStage("idle");
                }}
              />
              <span className="capitalize">
                {card.brand ?? "Card"} ···· {card.last4 ?? "····"}
              </span>
            </label>
          ))}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="radio"
              name="payment-card"
              className="accent-primary"
              checked={selected === "new"}
              onChange={() => {
                setSelected("new");
                setValid(false);
                setProblem(null);
                setStage("idle");
              }}
            />
            <span>Use a different card</span>
          </label>
        </div>
      )}

      <DuffelCardForm
        ref={ref}
        clientKey={session.clientKey}
        intent={intent}
        styles={formStyles}
        {...(savedCard
          ? { savedCardData: { id: savedCard.providerCardId, brand: savedCard.brand ?? "visa" } }
          : {})}
        onValidateSuccess={() => {
          setValid(true);
          setProblem(null);
        }}
        onValidateFailure={() => setValid(false)}
        onCreateCardForTemporaryUseSuccess={(card) => {
          void authorise(card.id, card.brand, card.last_4_digits);
        }}
        onCreateCardForTemporaryUseFailure={(error) => {
          console.error("card tokenisation failed", error);
          setStage("declined");
          setProblem("Those card details were not accepted. Please check them and try again.");
        }}
        onSaveCardSuccess={(card) => {
          void persistCard({
            data: {
              providerCardId: card.id,
              brand: card.brand,
              last4: card.last_4_digits,
            },
          }).catch((error) => console.error("saving card failed", error));
        }}
        onSaveCardFailure={(error) => console.error("save card failed", error)}
      />

      {!savedCard && (
        <label className="flex items-center gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="accent-primary"
            checked={saveForNextTime}
            onChange={() => setSaveForNextTime((s) => !s)}
          />
          Save this card for next time
        </label>
      )}

      {problem && <p className="text-sm text-primary">{problem}</p>}
      {stage === "authorising" && (
        <p className="text-sm text-muted-foreground">Checking your card with your bank…</p>
      )}
      {stage === "authorised" && !payingLabel && (
        <p className="text-sm text-muted-foreground">Card approved — completing your booking…</p>
      )}
      {payingLabel && <p className="text-sm text-muted-foreground">{payingLabel}</p>}

      <button
        type="button"
        disabled={!valid || busy || disabled || stage === "authorised"}
        onClick={() => {
          setProblem(null);
          setStage("tokenising");
          if (saveForNextTime && !savedCard) saveCard();
          createCardForTemporaryUse();
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        <Lock className="size-4" />
        {busy || stage === "authorised" ? "Paying…" : `Pay ${eur(amountEur)}`}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Card details go straight to our payment provider — they never reach Adair's servers.
      </p>
    </div>
  );
}
