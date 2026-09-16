/**
 * Checked bags and seats the airline actually sells for the chosen fare.
 * Pre-ticked from stored preferences; the customer can change any of it before
 * paying. Nothing is shown that the supplier did not offer.
 *
 * Seats render as the airline's real cross-section — the same rows and
 * sections Duffel's seat map returns — rather than a scrolling list of
 * checkboxes, so "12A" means something: which row, which side of the aisle,
 * whether it is already taken. When a fare publishes no seat map at all,
 * seatNote explains that seats are assigned at check-in instead.
 */
import { Luggage, Armchair } from "lucide-react";
import { eur } from "@/lib/trip/client";
import {
  seatDetail,
  type AncillaryOption,
  type AncillarySelection,
  type SeatMapRow,
} from "@/lib/trip/ancillaries";
import type { FlightAncillaries } from "@/lib/ancillaries.functions";

const rowClass =
  "flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3 text-sm";

const cellBase =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-medium";

function segmentLabel(index: number, total: number): string | null {
  if (total <= 1) return null;
  if (total === 2) return index === 0 ? "Outbound" : "Return";
  return `Flight ${index + 1}`;
}

function SeatGrid({
  rows,
  optionsById,
  chosen,
  onToggle,
}: {
  rows: SeatMapRow[];
  optionsById: Map<string, AncillaryOption>;
  chosen: Map<string, number>;
  onToggle: (option: AncillaryOption) => void;
}) {
  return (
    <div className="max-h-80 space-y-1.5 overflow-y-auto pb-1 pr-1">
      <div className="overflow-x-auto">
        <div className="w-fit space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground">
                {row.label}
              </span>
              <div className="flex items-center gap-3">
                {row.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="flex gap-1">
                    {section.map((cell, cellIndex) => {
                      if (cell.kind === "blank") {
                        return <span key={cellIndex} className="size-8 shrink-0" />;
                      }
                      if (cell.kind === "taken") {
                        return (
                          <span
                            key={cellIndex}
                            title="Already taken"
                            className={`${cellBase} border border-border bg-muted text-muted-foreground/50`}
                          >
                            {cell.column}
                          </span>
                        );
                      }
                      const option = optionsById.get(cell.id);
                      const isChosen = chosen.has(cell.id);
                      return (
                        <button
                          key={cellIndex}
                          type="button"
                          title={`Seat ${row.label}${cell.column} · ${eur(cell.priceEur)}${cell.extraLegroom ? " · extra legroom" : ""}`}
                          onClick={() => option && onToggle(option)}
                          className={`${cellBase} border transition-colors ${
                            isChosen
                              ? "border-primary bg-primary text-primary-foreground"
                              : cell.extraLegroom
                                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                                : "border-border hover:bg-muted"
                          }`}
                        >
                          {cell.column}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const optionsById = new Map(data.options.map((o) => [o.id, o]));

  const toggle = (option: AncillaryOption) => {
    if (chosen.has(option.id)) {
      onChange(selection.filter((s) => s.id !== option.id));
      return;
    }
    onChange([...selection, { id: option.id, quantity: 1 }]);
  };

  const bags = data.options.filter((o) => o.kind === "bag");
  const chosenSeats = data.options.filter((o) => o.kind === "seat" && chosen.has(o.id));
  const hasSeatMap = data.seatMaps.some((rows) => rows.length > 0);

  if (bags.length === 0 && !hasSeatMap && !data.bagNote && !data.seatNote) return null;

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

      <section className="space-y-3">
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Armchair className="h-4 w-4" /> Seats
        </p>
        {!hasSeatMap ? (
          <p className="text-sm text-muted-foreground">{data.seatNote}</p>
        ) : (
          <>
            {data.seatMaps.map((rows, index) => {
              if (rows.length === 0) return null;
              const label = segmentLabel(index, data.seatMaps.length);
              return (
                <div key={index} className="space-y-1.5">
                  {label && <p className="text-xs font-medium text-foreground">{label}</p>}
                  <SeatGrid
                    rows={rows}
                    optionsById={optionsById}
                    chosen={chosen}
                    onToggle={toggle}
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Tap a seat to pick it. Grey seats are already taken; the gap between blocks is the
              aisle.
            </p>
            {chosenSeats.length > 0 && (
              <ul className="space-y-1">
                {chosenSeats.map((option) => (
                  <li key={option.id} className="flex items-center justify-between text-sm">
                    <span>
                      {option.label}
                      {seatDetail(option) && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {seatDetail(option)}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">{eur(option.priceEur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
