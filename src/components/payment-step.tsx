/**
 * Client-only wrapper around the Duffel hosted card form.
 *
 * Duffel Cards has no Apple Pay or Google Pay support, so no wallet button is
 * rendered — a button that cannot complete a payment would be worse than none.
 */
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { PaymentSession } from "@/lib/payment.functions";
import type { AuthorisedPayment } from "./card-payment";

const CardPayment = lazy(() => import("./card-payment"));

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
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <CardPayment {...props} />
      </Suspense>
    </ClientOnly>
  );
}
