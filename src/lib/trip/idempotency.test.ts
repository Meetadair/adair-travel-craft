import { describe, expect, it } from "vitest";

import { isSettled, orderKey, paymentKey, shouldStopBeforeSupplier } from "./idempotency";

describe("booking idempotency", () => {
  it("uses one stable payment key per card", () => {
    expect(paymentKey("card-1")).toBe("card-1-payment");
    expect(paymentKey("card-1")).toBe(paymentKey("card-1"));
    expect(paymentKey("card-2")).not.toBe(paymentKey("card-1"));
  });

  it("uses one key per supplier line", () => {
    expect(orderKey("card-1", "flight")).toBe("card-1-flight");
    expect(orderKey("card-1", "flight")).not.toBe(orderKey("card-1", "stay"));
  });

  it("stops a retry once the payment settled", () => {
    expect(isSettled("settled")).toBe(true);
    expect(isSettled("test_settled")).toBe(true);
    expect(isSettled("failed")).toBe(false);
    expect(isSettled(null)).toBe(false);

    expect(
      shouldStopBeforeSupplier({ cardStatus: "held", earlierPaymentStatus: "test_settled" }),
    ).toBe(true);
    expect(shouldStopBeforeSupplier({ cardStatus: "booked" })).toBe(true);
  });

  it("lets a first attempt and a failed retry through", () => {
    expect(shouldStopBeforeSupplier({ cardStatus: "held" })).toBe(false);
    expect(shouldStopBeforeSupplier({ cardStatus: "held", earlierPaymentStatus: "failed" })).toBe(
      false,
    );
  });

  it("one key produces one order and one charge across retries", () => {
    const charges: string[] = [];
    const orders: string[] = [];
    const attempt = (cardStatus: string, earlier: string | null) => {
      if (shouldStopBeforeSupplier({ cardStatus, earlierPaymentStatus: earlier })) return earlier;
      const key = paymentKey("card-1");
      if (!charges.includes(key)) charges.push(key);
      const line = orderKey("card-1", "flight");
      if (!orders.includes(line)) orders.push(line);
      return "test_settled";
    };
    let status = attempt("held", null);
    status = attempt("held", status);
    status = attempt("booked", status);
    expect(charges).toHaveLength(1);
    expect(orders).toHaveLength(1);
  });
});
