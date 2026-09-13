/**
 * Saved details: payment cards added ahead of any booking.
 *
 * Nothing here knows which provider is active — the card wallet reports it, and
 * the matching hosted form is loaded on demand. Card numbers stay with the
 * payment provider; we only ever see brand, last four and expiry.
 */
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { getCardWallet, setDefaultCard } from "@/lib/cards.functions";
import { deleteSavedCard } from "@/lib/payment.functions";

const AddCardDuffel = lazy(() => import("./add-card-duffel"));
const AddCardStripe = lazy(() => import("./add-card-stripe"));

function expiry(month: number | null, year: number | null) {
  if (!month || !year) return null;
  return `${String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

export function PaymentCards() {
  const load = useServerFn(getCardWallet);
  const remove = useServerFn(deleteSavedCard);
  const makeDefault = useServerFn(setDefaultCard);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const wallet = useQuery({ queryKey: ["card-wallet"], queryFn: () => load() });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["card-wallet"] });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
  });
  const defaultMutation = useMutation({
    mutationFn: (id: string) => makeDefault({ data: { id } }),
    onSuccess: refresh,
  });

  const data = wallet.data;
  const cards = data?.cards ?? [];
  const wallets = (data?.methods ?? []).filter((method) => method !== "card");
  const canAdd = Boolean(data && !data.unavailable && (data.clientKey || data.clientSecret));

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="size-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Payment cards</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a card now and it will be ready when you book. The card details go straight to our
        payment provider — they never reach Adair.
      </p>

      {wallet.isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}

      {cards.length > 0 && (
        <ul className="mt-4 space-y-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3"
            >
              <span className="text-sm">
                <span className="capitalize">{card.brand ?? "Card"}</span> ···· {card.last4 ?? "····"}
                {expiry(card.expMonth, card.expYear) && (
                  <span className="text-muted-foreground">
                    {" "}
                    · expires {expiry(card.expMonth, card.expYear)}
                  </span>
                )}
                {card.isDefault && (
                  <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Default
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                {!card.isDefault && (
                  <button
                    type="button"
                    onClick={() => defaultMutation.mutate(card.id)}
                    className="text-xs underline decoration-border underline-offset-4 hover:text-foreground"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remove card"
                  onClick={() => removeMutation.mutate(card.id)}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {data?.unavailable === "not-configured" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Card payments are not switched on yet, so a card cannot be added.
        </p>
      )}
      {data?.unavailable === "not-supported" && (
        <p className="mt-4 text-sm text-muted-foreground">
          Cards can only be entered at the payment step for now.
        </p>
      )}
      {data?.unavailable === "failed" && (
        <p className="mt-4 text-sm text-muted-foreground">
          We could not open the secure card form. Please try again in a moment.
        </p>
      )}

      {canAdd && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:border-primary"
        >
          <Plus className="size-4" /> Add a card
        </button>
      )}

      {canAdd && adding && data && (
        <div className="mt-4">
          {data.testMode && (
            <p className="mb-3 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              Test mode — no real charge
            </p>
          )}
          <ClientOnly
            fallback={<p className="text-sm text-muted-foreground">Opening the secure form…</p>}
          >
            <Suspense
              fallback={<p className="text-sm text-muted-foreground">Opening the secure form…</p>}
            >
              {data.clientSecret && data.publishableKey ? (
                <AddCardStripe
                  publishableKey={data.publishableKey}
                  clientSecret={data.clientSecret}
                  onSaved={() => {
                    setAdding(false);
                    void refresh();
                  }}
                />
              ) : data.clientKey ? (
                <AddCardDuffel
                  clientKey={data.clientKey}
                  onSaved={() => {
                    setAdding(false);
                    void refresh();
                  }}
                />
              ) : null}
            </Suspense>
          </ClientOnly>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-3 block text-xs underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {data && !data.unavailable && (
        <p className="mt-4 text-xs text-muted-foreground">
          {wallets.includes("apple-pay") && wallets.includes("google-pay")
            ? "Available when paying with Apple Pay or Google Pay on this device."
            : wallets.includes("apple-pay")
              ? "Available when paying with Apple Pay on this device."
              : wallets.includes("google-pay")
                ? "Available when paying with Google Pay on this device."
                : "Cards only for now — Apple Pay and Google Pay are not available."}
        </p>
      )}
    </section>
  );
}
