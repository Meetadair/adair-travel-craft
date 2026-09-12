/**
 * Checked bags and seats the airline actually sells for the chosen fare.
 * Pre-ticked from stored preferences; the customer can change any of it before
 * paying. Nothing is shown that the supplier did not offer.
 */
import { Luggage, Armchair } from "lucide-react";
import { eur } from "@/lib/trip/client";
import {
  seatDetail,
  type AncillaryOption,
  type AncillarySelection,
} from "@/lib/trip/ancillaries";
import type { FlightAncillaries } from "@/lib/ancillaries.functions";

const rowClass =
  "flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm";

export function FlightExtras({
  data,
  selection,
  onChange,
}: {
  data: FlightAncillaries;
  selection: AncillarySelection[];
  onChange: (next: AncillarySelection[]) => void;
}) {
  const chosen = new Map(selection.map((s) => [s.id, s.quantity]));

  const toggle = (option: AncillaryOption) => {
    if (chosen.has(option.id)) {
      onChange(selection.filter((s) => s.id !== option.id));
      return;
    }
    onChange([...selection, { id: option.id, quantity: 1 }]);
  };

  const bags = data.options.filter((o) => o.kind === "bag");
  const seats = data.options.filter((o) => o.kind === "seat");

  if (bags.length === 0 && seats.length === 0 && !data.bagNote && !data.seatNote) return null;

  return (
    <div className="hairline-card mt-6 space-y-5 p-6">
      <h2 className="font-display text-lg font-semibold">Bags and seats</h2>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Luggage className="h-4 w-4" /> Checked bags
        </p>
        {bags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.bagNote}</p>
        ) : (
          bags.map((option) => (
            <label key={option.id} className={rowClass}>
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={chosen.has(option.id)}
                  onChange={() => toggle(option)}
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  {option.detail && (
                    <span className="block text-xs text-muted-foreground">{option.detail}</span>
                  )}
                </span>
              </span>
              <span className="whitespace-nowrap font-medium">{eur(option.priceEur)}</span>
            </label>
          ))
        )}
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Armchair className="h-4 w-4" /> Seats
        </p>
        {seats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.seatNote}</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {seats.slice(0, 40).map((option) => (
              <label key={option.id} className={rowClass}>
                <span className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={chosen.has(option.id)}
                    onChange={() => toggle(option)}
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {seatDetail(option) || "standard seat"}
                    </span>
                  </span>
                </span>
                <span className="whitespace-nowrap font-medium">{eur(option.priceEur)}</span>
              </label>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
