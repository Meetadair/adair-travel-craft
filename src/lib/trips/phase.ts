/**
 * Where a trip belongs in My trips. A trip stays under Upcoming until the day
 * after its return date, then moves to Past on its own. Cancelled trips are
 * always Past.
 */

export type PhaseTrip = {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

export type TripPhase = "now" | "upcoming" | "past";

/** Today as YYYY-MM-DD, in the traveller's own timezone. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The date that decides the split: the return date, or the departure date. */
function boundary(trip: PhaseTrip): string | null {
  return trip.endDate ?? trip.startDate ?? null;
}

export function tripPhase(trip: PhaseTrip, today: string = todayIso()): TripPhase {
  if (trip.status === "cancelled") return "past";
  const end = boundary(trip);
  if (!end) return "upcoming";
  if (end < today) return "past";
  const start = trip.startDate ?? end;
  if (start <= today && today <= end) return "now";
  return "upcoming";
}

/** True while the traveller is on this trip right now. */
export function isInProgress(trip: PhaseTrip, today: string = todayIso()): boolean {
  return tripPhase(trip, today) === "now";
}

/**
 * Upcoming first (in progress at the top, then soonest first), and past newest
 * first. Order is stable for trips sharing a date.
 */
export function splitTrips<T extends PhaseTrip>(
  trips: readonly T[],
  today: string = todayIso(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const trip of trips) {
    if (tripPhase(trip, today) === "past") past.push(trip);
    else upcoming.push(trip);
  }

  upcoming.sort((a, b) => {
    const aNow = isInProgress(a, today);
    const bNow = isInProgress(b, today);
    if (aNow !== bNow) return aNow ? -1 : 1;
    return (a.startDate ?? a.endDate ?? "9999").localeCompare(b.startDate ?? b.endDate ?? "9999");
  });

  past.sort((a, b) => (boundary(b) ?? "").localeCompare(boundary(a) ?? ""));

  return { upcoming, past };
}
