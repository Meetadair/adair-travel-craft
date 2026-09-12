/**
 * Optional extras on a signed-in trip card: airport transfers and dinner
 * reservations. Prices and venues only ever come from a live supplier answer;
 * until a partner is connected the section says so plainly.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CarTaxiFront, UtensilsCrossed } from "lucide-react";
import { getCardExtras, type CardExtras } from "@/lib/extras.functions";
import type { RideLeg } from "@/lib/suppliers/types";
import { eur } from "@/lib/trip/client";

const when = (local: string) => local.replace("T", " ").slice(0, 16);

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function TripExtras({
  cardId,
  rides,
  onToggleRide,
}: {
  cardId: string;
  /** Legs the traveller opted into, when the card is being booked. */
  rides?: RideLeg[];
  onToggleRide?: (leg: RideLeg) => void;
}) {
  const load = useServerFn(getCardExtras);
  const [extras, setExtras] = useState<CardExtras | null>(null);

  useEffect(() => {
    let active = true;
    void load({ data: { cardId } })
      .then((result) => {
        if (active) setExtras(result);
      })
      .catch(() => {
        if (active) setExtras(null);
      });
    return () => {
      active = false;
    };
  }, [cardId, load]);

  if (!extras) return null;
  const selected = rides ?? [];

  return (
    <>
      {extras.rides.options.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <CarTaxiFront className="size-3.5 text-primary" />
            <h4 className="text-sm font-medium">Airport transfers</h4>
          </div>

          <ul className="mt-3 space-y-3">
            {extras.rides.options.map((option) => {
              const quote = option.quotes[0] ?? null;
              const on = selected.includes(option.leg);
              return (
                <li key={option.leg} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {onToggleRide && quote ? (
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggleRide(option.leg)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {on ? option.label : `+ ${option.label}`} · {eur(quote.grossEur)}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">{option.label}</span>
                    )}
                    <Chip>{when(option.pickupAt)}</Chip>
                    {quote ? <Chip>{quote.providerLabel}</Chip> : null}
                    {quote?.etaMinutes != null ? <Chip>{quote.etaMinutes} min wait</Chip> : null}
                  </div>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {option.pickupAddress} → {option.dropoffAddress}
                  </p>
                </li>
              );
            })}
          </ul>

          {!extras.rides.connected && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Transfers available at launch. The pickup, drop-off and times above come from your
              itinerary — we will show a price once our ride partner is live.
            </p>
          )}
        </div>
      )}

      {extras.restaurants.dates.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-3.5 text-primary" />
            <h4 className="text-sm font-medium">Dinner reservations</h4>
          </div>

          {extras.restaurants.connected ? (
            <ul className="mt-3 space-y-3">
              {extras.restaurants.offers.map((offer) => (
                <li key={offer.offerRef} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{offer.name}</span>
                    <Chip>
                      {dayLabel(offer.date)} · {offer.time}
                    </Chip>
                    {offer.cuisine ? <Chip>{offer.cuisine}</Chip> : null}
                    {offer.distanceKm != null ? (
                      <Chip>{offer.distanceKm.toFixed(1)} km from your hotel</Chip>
                    ) : null}
                    <Chip>Table for {offer.partySize}</Chip>
                  </div>
                  {offer.match && (
                    <p className="mt-1 text-muted-foreground">
                      Matches {offer.match.met} of your {offer.match.total} food criteria
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {extras.restaurants.criteria.map((label) => (
                  <Chip key={label}>{label}</Chip>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extras.restaurants.dates.map((date) => (
                  <Chip key={date}>{dayLabel(date)}</Chip>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Restaurant booking opens at launch. These are the evenings of your trip and the
                criteria from your profile we will search on — no venues are suggested until our
                reservation partner is live.
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
