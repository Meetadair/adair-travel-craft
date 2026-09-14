/**
 * What state a trip is actually in.
 *
 * These were loose strings scattered across four files, and one of them was
 * wrong in a way that mattered: saving a shortlisted itinerary wrote
 * "confirmed", so My trips showed a reservation that no supplier had ever
 * heard of. A traveller could open it, try to change it, and be told a booking
 * reference did not exist — or worse, believe they had a seat.
 */

export type TripStatus =
  /** Composed but not kept. */
  | "draft"
  /** Kept by the traveller. Nothing is reserved and nobody has been paid. */
  | "saved"
  /** A supplier order exists. This is the only state that means booked. */
  | "confirmed"
  /** Superseded by a changed booking. */
  | "changed"
  | "cancelled"
  | "failed";

/** Is there a supplier order behind this trip? Only then may we offer to change or cancel it. */
export function isBooked(status: string): boolean {
  return status === "confirmed" || status === "changed";
}

/** A trip the traveller may still act on, as opposed to one that is over. */
export function isLive(status: string): boolean {
  return status !== "cancelled" && status !== "failed";
}

/** Shown to the traveller. "Saved" must never read as "Booked". */
export const STATUS_LABEL: Record<TripStatus, string> = {
  draft: "Draft",
  saved: "Saved",
  confirmed: "Booked",
  changed: "Changed",
  cancelled: "Cancelled",
  failed: "Failed",
};
