/**
 * Flight extras — checked bags and seats offered by the airline for a chosen
 * fare. Nothing here invents an option: everything comes from the supplier's
 * own list of available services. Pure functions only, safe on the client.
 */
/** The markup applied to extras, in basis points, from `pricing_rules`. */
export type MarkupRule = { markupBps: number; discountBps: number };

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

/**
 * Raw shapes from Duffel's `/air/seat_maps`, kept minimal on purpose — only
 * the fields the grid below actually reads.
 */
export type RawSeatMapElement = {
  type?: string;
  designator?: string;
  disclosures?: string[];
  available_services?: Array<{ id: string; total_amount: string; total_currency: string }>;
};
export type RawSeatMapSection = { elements?: RawSeatMapElement[] };
export type RawSeatMapRow = { sections?: RawSeatMapSection[] };
export type RawSeatMapCabin = { rows?: RawSeatMapRow[] };

/** One square in the cross-section grid. */
export type SeatCell =
  | { kind: "seat"; id: string; column: string; priceEur: number; extraLegroom: boolean }
  | { kind: "taken"; column: string | null }
  | { kind: "blank" };

/** One row of the plane, sections in supplier order so aisles render as gaps. */
export type SeatMapRow = { label: string; sections: SeatCell[][] };

/**
 * Turns Duffel's cabin/row/section tree into a real cross-section grid, and
 * the flat pricing options the rest of the checkout already understands.
 * A row with no sellable or occupied seat (all galley, lavatory, exit signage)
 * is dropped rather than shown as a mysteriously empty line.
 */
export function buildSeatMap(
  cabins: RawSeatMapCabin[],
  rule: MarkupRule,
): { options: AncillaryOption[]; rows: SeatMapRow[] } {
  const options: AncillaryOption[] = [];
  const rows: SeatMapRow[] = [];

  for (const cabin of cabins) {
    for (const row of cabin.rows ?? []) {
      const sections = row.sections ?? [];
      const seatsBySection = sections.map((section) =>
        (section.elements ?? []).filter((element) => element.type === "seat"),
      );

      let label: string | null = null;
      for (const seats of seatsBySection) {
        const withDesignator = seats.find((s) => s.designator);
        const digits = withDesignator?.designator?.match(/\d+/)?.[0];
        if (digits) {
          label = digits;
          break;
        }
      }
      if (!label) continue;

      const cellSections: SeatCell[][] = sections.map((section, sectionIndex) => {
        const seats = seatsBySection[sectionIndex] ?? [];
        return (section.elements ?? []).map((element): SeatCell => {
          if (element.type !== "seat") return { kind: "blank" };

          const designator = element.designator ?? null;
          const column = designator ? designator.replace(/^\d+/, "") : null;
          const indexInSection = seats.indexOf(element);

          const service = element.available_services?.[0];
          const netEur = service ? Number(service.total_amount) : NaN;
          if (!service || !Number.isFinite(netEur)) return { kind: "taken", column };

          const disclosures = (element.disclosures ?? []).join(" ").toLowerCase();
          const extraLegroom =
            disclosures.includes("legroom") || disclosures.includes("extra space");

          let position: "window" | "aisle" | "middle";
          const lastIndex = seats.length - 1;
          if (sections.length === 1) {
            position =
              indexInSection === 0 ? "window" : indexInSection === lastIndex ? "aisle" : "middle";
          } else if (sectionIndex === 0) {
            position =
              indexInSection === 0 ? "window" : indexInSection === lastIndex ? "aisle" : "middle";
          } else if (sectionIndex === sections.length - 1) {
            position =
              indexInSection === lastIndex ? "window" : indexInSection === 0 ? "aisle" : "middle";
          } else {
            position = indexInSection === 0 || indexInSection === lastIndex ? "aisle" : "middle";
          }

          const priceEur = customerPriceEur(netEur, rule);
          options.push({
            id: service.id,
            kind: "seat",
            label: seatLabel(designator),
            detail: null,
            netEur,
            priceEur,
            currency: service.total_currency,
            maxQuantity: 1,
            seat: { position, extraLegroom },
          });

          return { kind: "seat", id: service.id, column: column ?? "", priceEur, extraLegroom };
        });
      });

      rows.push({ label, sections: cellSections });
    }
  }

  return { options, rows };
}

export const ANCILLARY_NONE_NOTE =
  "This fare includes a cabin bag only; checked bags can't be added.";

export const ANCILLARY_NO_SEATS_NOTE =
  "The airline assigns seats at check-in for this fare, so seats can't be chosen here.";

/** Applies the extras markup to a supplier price. */
export function customerPriceEur(netEur: number, rule: MarkupRule): number {
  const bps = 10_000 + rule.markupBps - rule.discountBps;
  return Math.round(Math.round(netEur * 100) * (bps / 10_000)) / 100;
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
