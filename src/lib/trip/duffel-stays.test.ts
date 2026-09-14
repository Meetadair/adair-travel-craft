import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookStay,
  cancelStayBooking,
  freeCancellationUntil,
  isProductDisabled,
  quoteRate,
} from "./duffel-stays.server";

type Reply = { status: number; body: unknown };

/** Answers each Duffel call in order; records what was sent. */
function stubDuffel(replies: Reply[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error("unexpected call " + url);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const quoteBody = (amount = "300.00") => ({
  data: {
    id: "quo_1",
    total_amount: amount,
    total_currency: "EUR",
    expires_at: "2026-10-01T10:00:00Z",
    cancellation_timeline: [
      { before: "2026-10-10T00:00:00Z", refund_amount: amount, currency: "EUR" },
      { before: "2026-10-14T00:00:00Z", refund_amount: "0.00", currency: "EUR" },
    ],
  },
});

const bookingBody = {
  data: {
    id: "bok_1",
    reference: "HTL123",
    status: "confirmed",
    total_amount: "300.00",
    total_currency: "EUR",
    check_in_date: "2026-10-15",
    check_out_date: "2026-10-17",
  },
};

const input = {
  rateId: "rat_1",
  expectedAmount: 300,
  guests: [{ givenName: "Anna", familyName: "Nowak" }],
  email: "anna@example.com",
  phone: "+48600000000",
  idempotencyKey: "card-1-stay",
};

describe("duffel stays", () => {
  beforeEach(() => {
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_x");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("quotes, then books with the quote id, guests, contact and balance payment", async () => {
    const calls = stubDuffel([
      { status: 201, body: quoteBody() },
      { status: 201, body: bookingBody },
    ]);
    const outcome = await bookStay({ ...input, loyaltyProgrammeAccountNumber: "MB123" });

    expect(outcome.status).toBe("confirmed");
    if (outcome.status !== "confirmed") return;
    expect(outcome.booking.bookingReference).toBe("HTL123");
    expect(outcome.booking.id).toBe("bok_1");
    expect(outcome.repriced).toBeNull();
    expect(outcome.loyaltySent).toBe(true);

    expect(calls[0]?.url).toBe("https://api.duffel.com/stays/quotes");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ data: { rate_id: "rat_1" } });

    const sent = JSON.parse(String(calls[1]?.init.body)).data;
    expect(calls[1]?.url).toBe("https://api.duffel.com/stays/bookings");
    expect(sent.quote_id).toBe("quo_1");
    expect(sent.guests).toEqual([{ given_name: "Anna", family_name: "Nowak" }]);
    expect(sent.email).toBe("anna@example.com");
    expect(sent.phone_number).toBe("+48600000000");
    expect(sent.loyalty_programme_account_number).toBe("MB123");
    expect(sent.payment).toEqual({ type: "balance", amount: "300.00", currency: "EUR" });
    const headers = calls[1]?.init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("card-1-stay");
    expect(headers["Duffel-Version"]).toBe("v2");
  });

  it("pays by card when a 3-D Secure session is present", async () => {
    const calls = stubDuffel([
      { status: 201, body: quoteBody() },
      { status: 201, body: bookingBody },
    ]);
    await bookStay({ ...input, cardPayment: { threeDSecureSessionId: "3ds_1" } });
    const sent = JSON.parse(String(calls[1]?.init.body)).data;
    expect(sent.payment).toEqual({
      type: "card",
      amount: "300.00",
      currency: "EUR",
      three_d_secure_session_id: "3ds_1",
    });
  });

  it("treats 403 on the quote as 'product not enabled' — no booking attempt", async () => {
    const calls = stubDuffel([{ status: 403, body: { errors: [{ code: "access_denied" }] } }]);
    const outcome = await bookStay(input);
    expect(outcome).toEqual({ status: "not-enabled" });
    expect(calls).toHaveLength(1);
  });

  it("treats a missing key as 'product not enabled'", async () => {
    vi.stubEnv("DUFFEL_API_KEY", "");
    stubDuffel([]);
    const outcome = await bookStay(input);
    expect(outcome).toEqual({ status: "not-enabled" });
  });

  it("reports an expired rate as a failure, not as 'not enabled'", async () => {
    stubDuffel([{ status: 422, body: { errors: [{ code: "rate_expired" }] } }]);
    const outcome = await bookStay(input);
    expect(outcome).toEqual({ status: "failed", reason: "rate-expired" });
  });

  it("reports a reprice when the quote differs from the searched amount", async () => {
    stubDuffel([
      { status: 201, body: quoteBody("330.00") },
      {
        status: 201,
        body: { ...bookingBody, data: { ...bookingBody.data, total_amount: "330.00" } },
      },
    ]);
    const outcome = await bookStay(input);
    expect(outcome.status).toBe("confirmed");
    if (outcome.status !== "confirmed") return;
    expect(outcome.repriced).toEqual({ from: 300, to: 330 });
  });

  it("a failed booking after a good quote is a real failure", async () => {
    stubDuffel([
      { status: 201, body: quoteBody() },
      { status: 500, body: { errors: [] } },
    ]);
    const outcome = await bookStay(input);
    expect(outcome).toEqual({ status: "failed", reason: "supplier-error" });
  });

  it("cancels a booking and reports the supplier's state", async () => {
    stubDuffel([
      {
        status: 200,
        body: { data: { id: "bok_1", status: "cancelled", cancelled_at: "2026-09-14T10:00:00Z" } },
      },
    ]);
    expect(await cancelStayBooking("bok_1")).toEqual({ status: "cancelled" });
  });

  it("keeps the cancellation timeline and finds the free-cancellation deadline", async () => {
    stubDuffel([{ status: 201, body: quoteBody() }]);
    const quote = await quoteRate("rat_1");
    expect(quote.cancellationTimeline).toHaveLength(2);
    expect(freeCancellationUntil(quote.cancellationTimeline)).toBe("2026-10-10T00:00:00Z");
    expect(freeCancellationUntil([])).toBeNull();
  });

  it("classifies only auth and missing-key errors as product disabled", () => {
    expect(isProductDisabled(new Error("duffel-401"))).toBe(true);
    expect(isProductDisabled(new Error("duffel-403"))).toBe(true);
    expect(isProductDisabled(new Error("missing-key"))).toBe(true);
    expect(isProductDisabled(new Error("duffel-422"))).toBe(false);
    expect(isProductDisabled(new Error("duffel-500"))).toBe(false);
  });
});
