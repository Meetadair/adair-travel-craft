/**
 * What a good assistant notices about the proposal it just built.
 *
 * Every line comes from real data on the card: distances, hotel amenities and
 * rate inclusions, the backwards arrival plan, the nearby-date price comparison.
 * At most two lines per card, the two most valuable.
 */

export type AdviceActionKind =
  | "swap_car_for_transfer"
  | "take_earlier_flight"
  | "show_cheaper_dates"
  | "add_breakfast";

export type AdviceAction = {
  kind: AdviceActionKind;
  label: string;
  /** Alternative index on the card, where the action swaps a line. */
  index?: number;
};

export type AdviceLine = {
  kind: "tight_flight" | "peak_prices" | "transfer_beats_car" | "breakfast";
  text: string;
  /** How valuable the line is; only the top two are shown. */
  value: number;
  action?: AdviceAction;
};

export type AdviceCopy = {
  tightFlight: string;
  tightFlightNoOption: string;
  tightFlightAction: string;
  peak: string;
  peakEvent: string;
  peakSaving: string;
  peakAction: string;
  transfer: string;
  transferCheaper: string;
  transferAction: string;
  breakfast: string;
  breakfastAction: string;
};

export const ADVICE_COPY: AdviceCopy = {
  tightFlight:
    "This flight lands at {land} for a {meeting} meeting — tight. The {alt} gives you {spare} for {extra} more.",
  tightFlightNoOption: "This flight lands at {land} for a {meeting} meeting — that is tight.",
  tightFlightAction: "Take the earlier flight",
  peak: "Prices are {ratio}× the usual{event}.",
  peakEvent: " — {event} week",
  peakSaving: " {days} days later saves {saving}.",
  peakAction: "Show cheaper dates",
  transfer:
    "The hotel is {minutes} minutes from the airport and has no garage — a transfer is simpler than the car.",
  transferCheaper:
    "The hotel is {minutes} minutes from the airport and has no garage — a transfer is {saving} cheaper than the car.",
  transferAction: "Swap the car for a transfer",
  breakfast: "Breakfast isn't included at this rate; the one with breakfast is {amount} more.",
  breakfastAction: "Add breakfast",
};

export type AdviceInput = {
  hotel?: {
    /** Driving minutes from the arrival airport, when we know both points. */
    airportMinutes?: number | null;
    /** False when the property lists no parking or garage. */
    hasParking?: boolean | null;
    /** False when the chosen rate is room only. */
    breakfastIncluded?: boolean | null;
    /** Extra cost of the same stay with breakfast, in EUR. */
    breakfastExtraEur?: number | null;
    /** Alternative index on the card for the rate with breakfast. */
    breakfastAlternativeIndex?: number | null;
  } | null;
  car?: { priceEur: number } | null;
  /** Estimated airport transfer cost in EUR, when a ride supplier is connected. */
  transferEur?: number | null;
  arrival?: {
    tight: boolean;
    landAtLabel: string;
    meetingAtLabel: string;
    safer?: {
      title: string;
      spareLabel: string;
      extraEur: number;
      index: number;
    } | null;
  } | null;
  price?: {
    peak: boolean;
    ratio: number;
    savingEur: number;
    offsetDays: number | null;
    eventName: string | null;
  } | null;
  /** How money is written for this locale, e.g. "€40". */
  money?: (amountEur: number) => string;
};

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

const defaultMoney = (amount: number) => `€${Math.round(amount)}`;

/** The advice lines for this card, most valuable first, capped at two. */
export function buildAdvice(input: AdviceInput, copy: AdviceCopy = ADVICE_COPY): AdviceLine[] {
  const money = input.money ?? defaultMoney;
  const lines: AdviceLine[] = [];

  const arrival = input.arrival;
  if (arrival?.tight) {
    if (arrival.safer) {
      lines.push({
        kind: "tight_flight",
        value: 100,
        text: fill(copy.tightFlight, {
          land: arrival.landAtLabel,
          meeting: arrival.meetingAtLabel,
          alt: arrival.safer.title,
          spare: arrival.safer.spareLabel,
          extra: money(arrival.safer.extraEur),
        }),
        action: {
          kind: "take_earlier_flight",
          label: copy.tightFlightAction,
          index: arrival.safer.index,
        },
      });
    } else {
      lines.push({
        kind: "tight_flight",
        value: 95,
        text: fill(copy.tightFlightNoOption, {
          land: arrival.landAtLabel,
          meeting: arrival.meetingAtLabel,
        }),
      });
    }
  }

  const price = input.price;
  if (price?.peak && price.ratio >= 1.3) {
    const event = price.eventName ? fill(copy.peakEvent, { event: price.eventName }) : "";
    const saving =
      price.offsetDays && price.savingEur > 0
        ? fill(copy.peakSaving, {
            days: String(Math.abs(price.offsetDays)),
            saving: money(price.savingEur),
          })
        : "";
    lines.push({
      kind: "peak_prices",
      value: 80,
      text: `${fill(copy.peak, { ratio: price.ratio.toFixed(1).replace(/\.0$/, "") , event })}${saving}`,
      ...(price.offsetDays
        ? { action: { kind: "show_cheaper_dates" as const, label: copy.peakAction } }
        : {}),
    });
  }

  const hotel = input.hotel;
  if (hotel && input.car && hotel.hasParking === false && (hotel.airportMinutes ?? 0) > 0) {
    const minutes = String(Math.round(hotel.airportMinutes!));
    const cheaper =
      typeof input.transferEur === "number" && input.transferEur < input.car.priceEur
        ? input.car.priceEur - input.transferEur
        : null;
    lines.push({
      kind: "transfer_beats_car",
      value: 60,
      text:
        cheaper != null
          ? fill(copy.transferCheaper, { minutes, saving: money(cheaper) })
          : fill(copy.transfer, { minutes }),
      action: { kind: "swap_car_for_transfer", label: copy.transferAction },
    });
  }

  if (hotel?.breakfastIncluded === false && (hotel.breakfastExtraEur ?? 0) > 0) {
    lines.push({
      kind: "breakfast",
      value: 40,
      text: fill(copy.breakfast, { amount: money(hotel.breakfastExtraEur!) }),
      ...(hotel.breakfastAlternativeIndex != null
        ? {
            action: {
              kind: "add_breakfast" as const,
              label: copy.breakfastAction,
              index: hotel.breakfastAlternativeIndex,
            },
          }
        : {}),
    });
  }

  return lines.sort((a, b) => b.value - a.value).slice(0, 2);
}
