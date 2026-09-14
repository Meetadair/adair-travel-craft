/**
 * The flight choice on the card.
 *
 * Two or three options, the recommendation marked and reasoned, and under each
 * alternative the whole trade-off: the fare difference AND what the choice
 * costs after booking. The bare "−€230" never appears alone — that number is
 * the lie this component exists to prevent.
 *
 * Follows the approved mockup: recommended first, one line of reason in
 * Adair's voice, expandable detail per option.
 */
import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import type { FlightOptions } from "@/lib/trip/flight-options";
import { flexibilityOf } from "@/lib/trip/fare-flexibility";

const eur = (value: number): string => `€${Math.abs(Math.round(value)).toLocaleString("en-GB")}`;

export function FlightChoice({
  choice,
  selectedOfferId,
  onSelect,
}: {
  choice: FlightOptions;
  /** Offer currently on the card; defaults to the recommendation. */
  selectedOfferId: string | null;
  onSelect: (offerId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (choice.options.length < 2) return null;

  const active =
    selectedOfferId ?? choice.options.find((option) => option.recommended)?.flight.offerId ?? null;

  return (
    <div className="mt-3 space-y-2">
      {choice.recommendation && (
        <p className="text-sm leading-relaxed text-muted-foreground">{choice.recommendation}</p>
      )}

      {choice.options.map((option) => {
        const id = option.flight.offerId;
        const isActive = id === active;
        const isOpen = open === id;
        const delta = option.effectiveDeltaEur;

        return (
          <div
            key={id}
            className={
              isActive
                ? "rounded-xl border border-primary bg-background"
                : "rounded-xl border border-border bg-background"
            }
          >
            <button
              type="button"
              onClick={() => onSelect(id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
                  <span className="truncate">
                    {option.flight.carrier} {option.flight.flightNumbers[0] ?? ""}
                  </span>
                  {option.recommended && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                      Our pick
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.flight.departAt.slice(11, 16)} – {option.flight.arriveAt.slice(11, 16)}
                  {typeof option.flight.stops === "number" && (
                    <>
                      {" · "}
                      {option.flight.stops === 0
                        ? "direct"
                        : `${option.flight.stops} stop${option.flight.stops === 1 ? "" : "s"}`}
                    </>
                  )}
                </span>
                {/* Whether the fare can be moved, and what that costs. The
                    airline states it on every offer and it is frequently the
                    deciding fact — on a real Warsaw–London search the cheaper
                    fare was also the one you could change for a third of the
                    fee. An airline that states nothing gets nothing said. */}
                {(() => {
                  const flex = flexibilityOf(option.flight);
                  if (!flex.label) return null;
                  return (
                    <span
                      className={
                        flex.tone === "free"
                          ? "mt-1 inline-block rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-foreground"
                          : flex.tone === "penalty"
                            ? "mt-1 inline-block rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                            : "mt-1 inline-block text-[11px] text-muted-foreground"
                      }
                      title={flex.detail ?? undefined}
                    >
                      {flex.label}
                    </span>
                  );
                })()}
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold">
                  {option.recommended
                    ? eur(option.flight.amountEur)
                    : delta === 0
                      ? "same in the end"
                      : `${delta < 0 ? "−" : "+"}${eur(delta)}`}
                </span>
                {!option.recommended && (
                  <span className="block text-[11px] text-muted-foreground">
                    {/* The honest number: fare plus what comes later. */}
                    all costs in
                  </span>
                )}
              </span>
            </button>

            {(option.gives.length > 0 || option.costsLater.length > 0) && (
              <div className="border-t border-border px-4 py-2">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  What this choice means
                </button>

                {isOpen && (
                  <div className="mt-2 space-y-1.5 pb-1 text-xs leading-relaxed">
                    {option.gives.map((line) => (
                      <p key={line}>
                        <span className="text-muted-foreground">Gives you:</span> {line}
                      </p>
                    ))}
                    {option.costsLater.map((line) => (
                      <p key={line}>
                        <span className="text-muted-foreground">Costs later:</span> {line}
                      </p>
                    ))}
                    {option.hasUnpricedCost && (
                      <p className="text-muted-foreground">
                        One of these costs has no published price, so the true total may be higher.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
