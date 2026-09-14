import { describe, expect, it } from "vitest";
import { STATUS_LABEL, isBooked, isLive } from "./trip-status";

describe("trip status", () => {
  it("does not treat a saved itinerary as booked", () => {
    // The bug this file exists for: saveTrip wrote "confirmed", so a
    // shortlisted trip appeared in My trips as a live reservation.
    expect(isBooked("saved")).toBe(false);
    expect(isBooked("draft")).toBe(false);
  });

  it("treats only a trip with a supplier order as booked", () => {
    expect(isBooked("confirmed")).toBe(true);
    expect(isBooked("changed")).toBe(true);
  });

  it("never labels a saved trip as booked to the traveller", () => {
    expect(STATUS_LABEL.saved).toBe("Saved");
    expect(STATUS_LABEL.saved).not.toBe(STATUS_LABEL.confirmed);
  });

  it("counts a cancelled or failed trip as no longer live", () => {
    expect(isLive("cancelled")).toBe(false);
    expect(isLive("failed")).toBe(false);
    expect(isLive("saved")).toBe(true);
  });
});
