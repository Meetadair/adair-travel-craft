import { describe, expect, it } from "vitest";
import { isInProgress, splitTrips, todayIso, tripPhase } from "./phase";

const today = "2026-09-13";

const trip = (id: string, startDate: string | null, endDate: string | null, status = "booked") => ({
  id,
  status,
  startDate,
  endDate,
});

describe("tripPhase", () => {
  it("keeps a trip upcoming on its return day", () => {
    expect(tripPhase(trip("a", "2026-09-10", today), today)).toBe("now");
  });

  it("moves a trip to past the day after the return date", () => {
    expect(tripPhase(trip("a", "2026-09-10", "2026-09-12"), today)).toBe("past");
  });

  it("marks a trip in progress right now", () => {
    expect(isInProgress(trip("a", "2026-09-12", "2026-09-15"), today)).toBe(true);
    expect(isInProgress(trip("b", "2026-09-20", "2026-09-22"), today)).toBe(false);
  });

  it("treats a trip starting today as in progress", () => {
    expect(tripPhase(trip("a", today, "2026-09-16"), today)).toBe("now");
  });

  it("puts cancelled trips in past even with future dates", () => {
    expect(tripPhase(trip("a", "2026-10-01", "2026-10-03", "cancelled"), today)).toBe("past");
  });

  it("falls back to the departure date when there is no return date", () => {
    expect(tripPhase(trip("a", "2026-09-12", null), today)).toBe("past");
    expect(tripPhase(trip("b", "2026-09-14", null), today)).toBe("upcoming");
  });

  it("keeps a trip without dates upcoming", () => {
    expect(tripPhase(trip("a", null, null), today)).toBe("upcoming");
  });
});

describe("splitTrips", () => {
  it("sorts upcoming soonest first with the trip in progress at the top", () => {
    const { upcoming } = splitTrips(
      [
        trip("later", "2026-10-01", "2026-10-04"),
        trip("soon", "2026-09-20", "2026-09-22"),
        trip("now", "2026-09-12", "2026-09-15"),
      ],
      today,
    );
    expect(upcoming.map((t) => t.id)).toEqual(["now", "soon", "later"]);
  });

  it("sorts past newest first and includes cancelled trips", () => {
    const { past } = splitTrips(
      [
        trip("old", "2026-05-01", "2026-05-03"),
        trip("recent", "2026-09-08", "2026-09-11"),
        trip("cancelled", "2026-11-01", "2026-11-03", "cancelled"),
      ],
      today,
    );
    expect(past.map((t) => t.id)).toEqual(["cancelled", "recent", "old"]);
  });

  it("puts every trip in exactly one tab", () => {
    const trips = [trip("a", "2026-09-12", "2026-09-12"), trip("b", "2026-09-13", "2026-09-13")];
    const { upcoming, past } = splitTrips(trips, today);
    expect(upcoming.length + past.length).toBe(2);
  });
});

describe("todayIso", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(todayIso(new Date(2026, 8, 3))).toBe("2026-09-03");
  });
});
