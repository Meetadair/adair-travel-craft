/**
 * Release one booked line with the supplier who actually holds it.
 *
 * Cancelling used to mean the flight and nothing else. Changing a trip called
 * the airline; the hotel and the car were marked "cancelled" in our own table
 * and left live at the supplier. The traveller believed they had cancelled,
 * the hotel waited for someone who never came, and the no-show charge arrived
 * weeks later — a bill we had told them they did not owe.
 *
 * One place decides now, by kind, and says plainly what happened:
 *
 * - `cancelled` — the supplier confirmed it.
 * - `cancel-requested` — we asked and did not get a confirmation. Someone has
 *   to finish this by hand; it is not a success.
 * - `released` — nothing was ever held at a supplier (a line that never got
 *   past "requested"), so there is nothing to cancel.
 * - `unsupported` — a kind no supplier of ours can cancel over an API. Kept
 *   separate from success so it can never be reported as one.
 */
export type CancelOutcome = "cancelled" | "cancel-requested" | "released" | "unsupported";

export type CancellableItem = {
  kind: string;
  supplierOrderId: string | null;
};

/** True when the outcome still needs a human to finish the job. */
export function needsFollowUp(outcome: CancelOutcome): boolean {
  return outcome === "cancel-requested" || outcome === "unsupported";
}

/** One line for the traveller, so a partial cancellation is never silent. */
export function cancelNote(kind: string, outcome: CancelOutcome): string | null {
  switch (outcome) {
    case "cancelled":
    case "released":
      return null;
    case "cancel-requested":
      return `We asked the supplier to cancel the ${kind} and have not had confirmation yet — we are chasing it.`;
    case "unsupported":
      return `The ${kind} has to be cancelled by hand with the supplier — we are on it.`;
  }
}

export async function cancelAtSupplier(item: CancellableItem): Promise<CancelOutcome> {
  if (!item.supplierOrderId) return "released";

  try {
    switch (item.kind) {
      case "flight": {
        const { cancelFlightOrder } = await import("@/lib/trip/duffel-book.server");
        const result = await cancelFlightOrder(item.supplierOrderId);
        return result.status === "cancelled" ? "cancelled" : "cancel-requested";
      }
      case "stay": {
        const { cancelStayBooking } = await import("@/lib/trip/duffel-stays.server");
        const result = await cancelStayBooking(item.supplierOrderId);
        return result.status === "cancelled" ? "cancelled" : "cancel-requested";
      }
      case "car": {
        const { cancelCarBooking } = await import("@/lib/trip/duffel-cars.server");
        const result = await cancelCarBooking(item.supplierOrderId);
        return result.status === "cancelled" ? "cancelled" : "cancel-requested";
      }
      default:
        // An extra, a ride, an insurance line: nothing of ours cancels these
        // over an API today, and pretending otherwise is how a charge survives
        // a cancellation.
        return "unsupported";
    }
  } catch (error) {
    console.error(`cancelling the ${item.kind} failed`, error);
    return "cancel-requested";
  }
}
