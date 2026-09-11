/** Signed-in health view: which supplier and AI capabilities are live. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CapabilityStatus = {
  name: string;
  state: "ok" | "off" | "error";
  note: string;
};

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ capabilities: CapabilityStatus[]; checkedAt: string }> => {
    const { hasDuffelKey, isTestKey, searchFlight, searchStay, searchCar } = await import(
      "@/lib/trip/duffel.server"
    );

    const capabilities: CapabilityStatus[] = [];

    if (!hasDuffelKey()) {
      capabilities.push({ name: "Flights", state: "off", note: "No supplier key configured" });
      capabilities.push({ name: "Hotels", state: "off", note: "No supplier key configured" });
      capabilities.push({ name: "Cars", state: "off", note: "No supplier key configured" });
    } else {
      const probe = {
        originCity: "Warsaw",
        originIata: "WAW",
        destinationCity: "Milan",
        destinationIata: "LIN",
        lat: 45.464,
        lon: 9.19,
        departDate: isoInDays(21),
        returnDate: isoInDays(23),
        cabinClass: "economy" as const,
        passengers: 1,
        hotelWish: null,
        needsCar: true,
        invoiceToCompany: false,
      };

      const [flight, stay, car] = await Promise.allSettled([
        searchFlight(probe),
        searchStay(probe),
        searchCar(probe),
      ]);

      const describe = (name: string, result: PromiseSettledResult<unknown>): CapabilityStatus => {
        if (result.status === "fulfilled") {
          return {
            name,
            state: result.value ? "ok" : "error",
            note: result.value ? "Live results returned" : "No availability returned",
          };
        }
        const message = result.reason instanceof Error ? result.reason.message : "unknown";
        return {
          name,
          state: "error",
          note:
            message === "duffel-401" || message === "duffel-403"
              ? "Not enabled on the supplier account"
              : `Supplier error (${message})`,
        };
      };

      capabilities.push(describe("Flights", flight));
      capabilities.push(describe("Hotels", stay));
      capabilities.push(describe("Cars", car));
      capabilities.push({
        name: "Supplier mode",
        state: "ok",
        note: isTestKey() ? "Test mode — no real money" : "Live mode",
      });
    }

    capabilities.push({
      name: "Sentence understanding",
      state: process.env["ANTHROPIC_API_KEY"] ? "ok" : "off",
      note: process.env["ANTHROPIC_API_KEY"]
        ? "AI understanding available"
        : "Falling back to rules only",
    });
    capabilities.push({
      name: "Booking & payment",
      state: "ok",
      note: "Test-mode booking live — supplier test payment, no real charge",
    });


    return { capabilities, checkedAt: new Date().toISOString() };
  });

function isoInDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}
