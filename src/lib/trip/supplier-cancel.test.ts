import { describe, expect, it, vi, beforeEach } from "vitest";
import { cancelAtSupplier, cancelNote, needsFollowUp } from "./supplier-cancel";

vi.mock("@/lib/trip/duffel-book.server", () => ({
  cancelFlightOrder: vi.fn(async () => ({ status: "cancelled" })),
}));
vi.mock("@/lib/trip/duffel-stays.server", () => ({
  cancelStayBooking: vi.fn(async () => ({ status: "cancelled" })),
}));
vi.mock("@/lib/trip/duffel-cars.server", () => ({
  cancelCarBooking: vi.fn(async () => ({ status: "cancel-requested" })),
}));

describe("cancelAtSupplier", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancels a flight with the airline", async () => {
    expect(await cancelAtSupplier({ kind: "flight", supplierOrderId: "ord_1" })).toBe("cancelled");
  });

  it("cancels the hotel too — this is the one that used to be left live", async () => {
    expect(await cancelAtSupplier({ kind: "stay", supplierOrderId: "bok_1" })).toBe("cancelled");
  });

  it("does not call a cancellation a success when the supplier did not confirm", async () => {
    expect(await cancelAtSupplier({ kind: "car", supplierOrderId: "car_1" })).toBe(
      "cancel-requested",
    );
  });

  it("has nothing to cancel when nothing was ever held", async () => {
    expect(await cancelAtSupplier({ kind: "stay", supplierOrderId: null })).toBe("released");
  });

  it("keeps a kind we cannot cancel separate from one we did", async () => {
    expect(await cancelAtSupplier({ kind: "insurance", supplierOrderId: "x" })).toBe("unsupported");
  });

  it("treats a thrown supplier error as unfinished, never as done", async () => {
    const mod = await import("@/lib/trip/duffel-book.server");
    vi.mocked(mod.cancelFlightOrder).mockRejectedValueOnce(new Error("boom"));
    expect(await cancelAtSupplier({ kind: "flight", supplierOrderId: "ord_1" })).toBe(
      "cancel-requested",
    );
  });
});

describe("what the traveller is told", () => {
  it("says nothing when it is genuinely done", () => {
    expect(cancelNote("hotel", "cancelled")).toBeNull();
    expect(cancelNote("hotel", "released")).toBeNull();
  });

  it("says so plainly when it is not", () => {
    expect(cancelNote("hotel", "cancel-requested")).toMatch(/not had confirmation/);
    expect(cancelNote("car", "unsupported")).toMatch(/by hand/);
  });

  it("flags exactly the outcomes a person still has to finish", () => {
    expect(needsFollowUp("cancelled")).toBe(false);
    expect(needsFollowUp("released")).toBe(false);
    expect(needsFollowUp("cancel-requested")).toBe(true);
    expect(needsFollowUp("unsupported")).toBe(true);
  });
});
