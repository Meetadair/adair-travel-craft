import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The passport has to reach the airline. We stored companions' numbers
 * encrypted for weeks and never sent one — the order went out without any
 * identity document at all.
 */
describe("identity documents reach Duffel", () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv("DUFFEL_API_KEY", "duffel_test_x");
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return {
        ok: true,
        json: async () => ({
          data: { id: "ord_1", booking_reference: "ABC123", total_amount: "100.00" },
        }),
      } as unknown as Response;
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const base = {
    offerId: "off_1",
    amount: 100,
    currency: "EUR",
    passengerIds: ["pas_1"],
    idempotencyKey: "k1",
    traveller: {
      givenName: "Andrzej",
      familyName: "Krauze",
      email: "a@example.com",
      phone: "+48600000000",
      bornOn: "1980-01-01",
      gender: "m" as const,
      title: "mr" as const,
    },
  };

  const passengersOf = () => {
    const order = calls.find((c) => c.url.includes("/air/orders"));
    return (order?.body as { data: { passengers: Array<Record<string, unknown>> } }).data
      .passengers;
  };

  it("sends the passport in the shape Duffel documents", async () => {
    const { createFlightOrder } = await import("./duffel-book.server");
    await createFlightOrder({
      ...base,
      traveller: {
        ...base.traveller,
        passport: { number: "EA1234567", countryCode: "pl", expiresOn: "2030-05-01" },
      },
    });
    expect(passengersOf()[0]?.["identity_documents"]).toEqual([
      {
        type: "passport",
        unique_identifier: "EA1234567",
        issuing_country_code: "PL",
        expires_on: "2030-05-01",
      },
    ]);
  });

  it("omits the field entirely when there is no passport", async () => {
    const { createFlightOrder } = await import("./duffel-book.server");
    await createFlightOrder(base);
    expect(passengersOf()[0]).not.toHaveProperty("identity_documents");
  });

  it("gives each traveller their own document, not the lead's", async () => {
    const { createFlightOrder } = await import("./duffel-book.server");
    await createFlightOrder({
      ...base,
      passengerIds: ["pas_1", "pas_2"],
      traveller: {
        ...base.traveller,
        passport: { number: "AAA111", countryCode: "PL", expiresOn: "2030-05-01" },
      },
      companions: [
        {
          givenName: "Kitti",
          familyName: "Fodor",
          bornOn: "1985-03-03",
          gender: "f" as const,
          title: "ms" as const,
          passport: { number: "BBB222", countryCode: "HU", expiresOn: "2031-09-09" },
        },
      ],
    });
    const list = passengersOf();
    expect((list[0]?.["identity_documents"] as never[])[0]).toMatchObject({
      unique_identifier: "AAA111",
      issuing_country_code: "PL",
    });
    expect((list[1]?.["identity_documents"] as never[])[0]).toMatchObject({
      unique_identifier: "BBB222",
      issuing_country_code: "HU",
    });
  });
});
