/**
 * Checkout, driven entirely by what the active payment adapter reports.
 *
 * The provider comes from the `payment_providers` config row, and the wallet
 * options come from that adapter's `supportedMethods()` — never from an
 * assumption about any provider. Duffel Payments offers card only, so no wallet
 * button is rendered there; Stripe's Payment Element shows Apple Pay and Google
 * Pay itself, and only on devices that support them.
 */
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { PaymentSession } from "@/lib/payment.functions";
import type { AuthorisedPayment } from "./card-payment";

const CardPayment = lazy(() => import("./card-payment"));
const StripePayment = lazy(() => import("./stripe-payment"));

export type { AuthorisedPayment };

function Loading() {
  return <p className="text-sm text-muted-foreground">Opening the secure card form…</p>;
}

export function PaymentStep(props: {
  session: PaymentSession;
  amountEur: number;
  disabled?: boolean;
  payingLabel?: string | null;
  onAuthorised: (payment: AuthorisedPayment) => void;
}) {
  const { session } = props;
  const wallets = session.methods.filter((method) => method !== "card");
  const Checkout = session.provider === "stripe" ? StripePayment : CardPayment;

  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <div className="space-y-3">
          <Checkout {...props} />
          {session.methods.length > 0 && wallets.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {session.providerLabel} accepts cards only — Apple Pay and Google Pay are not
              available here.
            </p>
          )}
        </div>
      </Suspense>
    </ClientOnly>
  );
}
