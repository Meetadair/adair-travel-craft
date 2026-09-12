/**
 * Flight extras — checked bags and seats offered by the airline for a chosen
 * fare. Nothing here invents an option: everything comes from the supplier's
 * own list of available services. Pure functions only, safe on the client.
 */
import { grossMinor, type MarkupRule } from "./pricing-shared";

export type AncillaryKind = "bag" | "seat";

export type AncillaryOption = {
  /** Supplier service id, passed straight back when ordering. */
  id: string;
  kind: AncillaryKind;
  /** Short label for the card, e.g. "Checked bag · 23 kg". */
  label: string;
  /** Extra detail, e.g. "Seat 12A · window · extra legroom". */
  detail: string | null;
  /** Customer price for one unit, after the extras markup. */
  priceEur: number;
  /** Supplier price for one unit, kept for the margin calculation. */
  netEur: number;
  currency: string;
  /** How many of this service the airline allows. */
  maxQuantity: number;
  /** Seat traits, used for pre-selection from stored preferences. */
  seat?: { position: "window" | "aisle" | "middle" | "unknown"; extraLegroom: boolean };
  /** Bag traits, used for pre-selection on longer trips. */
  bag?: { weightKg: number | null };
};

/** Chosen extras, as sent back when booking. */
export type AncillarySelection = { id: string; quantity: number };

export const ANCILLARY_NONE_NOTE =
  "This fare includes a cabin bag only; checked bags can't be added.";

export const ANCILLARY_NO_SEATS_NOTE =
  "The airline assigns seats at check-in for this fare, so seats can't be chosen here.";

/** Applies the extras markup to a supplier price. */
export function customerPriceEur(netEur: number, rule: MarkupRule): number {
  return grossMinor(netEur, rule) / 100;
}

export function bagLabel(weightKg: number | null): string {
  return weightKg ? `Checked bag · ${weightKg} kg` : "Checked bag";
}

export function seatLabel(designator: string | null): string {
  return designator ? `Seat ${designator}` : "Seat selection";
}

export function seatDetail(option: AncillaryOption): string {
  const traits: string[] = [];
  if (option.seat && option.seat.position !== "unknown") traits.push(option.seat.position);
  if (option.seat?.extraLegroom) traits.push("extra legroom");
  return traits.join(" · ");
}

/** Preferences that drive which extras are ticked before the customer looks. */
export type AncillaryPrefs = {
  seat: "window" | "aisle" | "any";
  seatFront: boolean;
  seatLegroom: boolean;
};

/**
 * Pre-selects one seat matching the stored preference and, on trips longer
 * than two nights, the cheapest checked bag per traveller. The customer can
 * change either before paying.
 */
export function preselectAncillaries(
  options: AncillaryOption[],
  prefs: AncillaryPrefs,
  input: { nights: number; passengers: number },
): AncillarySelection[] {
  const selection: AncillarySelection[] = [];

  const seats = options.filter((o) => o.kind === "seat");
  if (seats.length > 0) {
    const wanted = seats
      .filter((o) => (prefs.seat === "any" ? true : o.seat?.position === prefs.seat))
      .filter((o) => (prefs.seatLegroom ? o.seat?.extraLegroom === true : true));
    const pool = wanted.length > 0 ? wanted : seats;
    const cheapest = [...pool].sort((a, b) => a.priceEur - b.priceEur)[0];
    if (cheapest) {
      selection.push({
        id: cheapest.id,
        quantity: Math.min(Math.max(1, input.passengers), cheapest.maxQuantity),
      });
    }
  }

  const bags = options.filter((o) => o.kind === "bag");
  if (bags.length > 0 && input.nights > 2) {
    const cheapest = [...bags].sort((a, b) => a.priceEur - b.priceEur)[0];
    if (cheapest) {
      selection.push({
        id: cheapest.id,
        quantity: Math.min(Math.max(1, input.passengers), cheapest.maxQuantity),
      });
    }
  }

  return selection;
}

/** Customer total for the chosen extras. */
export function ancillariesTotalEur(
  options: AncillaryOption[],
  selection: AncillarySelection[],
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  const total = selection.reduce((sum, chosen) => {
    const option = byId.get(chosen.id);
    if (!option) return sum;
    return sum + option.priceEur * Math.max(0, chosen.quantity);
  }, 0);
  return Math.round(total * 100) / 100;
}

/** Supplier total, used for the margin that feeds creator commission. */
export function ancillariesNetEur(
  options: AncillaryOption[],
  selection: AncillarySelection[],
): number {
  const byId = new Map(options.map((o) => [o.id, o]));
  const total = selection.reduce((sum, chosen) => {
    const option = byId.get(chosen.id);
    if (!option) return sum;
    return sum + option.netEur * Math.max(0, chosen.quantity);
  }, 0);
  return Math.round(total * 100) / 100;
}

/** One trip line per chosen extra, for the card, My trips and the .ics. */
export function ancillaryLines(
  options: AncillaryOption[],
  selection: AncillarySelection[],
): Array<{ id: string; title: string; detail: string; quantity: number; priceEur: number }> {
  const byId = new Map(options.map((o) => [o.id, o]));
  return selection
    .map((chosen) => {
      const option = byId.get(chosen.id);
      if (!option || chosen.quantity < 1) return null;
      return {
        id: option.id,
        title: option.label,
        detail: option.detail ?? seatDetail(option),
        quantity: chosen.quantity,
        priceEur: Math.round(option.priceEur * chosen.quantity * 100) / 100,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);
}
