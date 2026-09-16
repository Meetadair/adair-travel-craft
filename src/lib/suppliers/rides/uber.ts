/**
 * Uber Guest Rides adapter — books airport transfers through Uber for
 * Business's Guest Trips API, which requests a ride for the traveller
 * without them needing their own Uber account or an OAuth sign-in.
 *
 * Needs three org-level credentials from an Uber for Business account:
 * UBER_CLIENT_ID and UBER_CLIENT_SECRET (client-credentials OAuth) plus
 * UBER_ORG_UUID (sent as x-uber-organizationuuid on every call). None of
 * these exist yet, so isConfigured() stays false and every call answers
 * "missing-key" until Adair has an Uber for Business account and adds them.
 *
 * Flow, per developer.uber.com/docs/guest-rides:
 *   token  → POST https://auth.uber.com/oauth/v2/token
 *            (client_credentials, scope guests.trips)
 *   search → POST https://api.uber.com/v1/guests/trips/estimates
 *   book   → POST https://api.uber.com/v1/guests/trips
 *   cancel → DELETE https://api.uber.com/v1/guests/trips/{request_id}
 *
 * Pricing uses the shared live FX source (see fx.server.ts) for approximate
 * conversion — and only on a fare
 * Uber actually returned. When Uber has no exact upfront price for a route
 * (only a "$13-16" style range), that product is left out rather than
 * turning a range into an invented single number.
 */
import {
  ok,
  unavailable,
  type AdapterResult,
  type RideAdapter,
  type RideGuest,
  type RideOrder,
  type RidePlan,
  type RideQuote,
} from "@/lib/suppliers/types";
import { fxRate } from "@/lib/fx.server";

const AUTH_BASE = "https://auth.uber.com";
const API_BASE = "https://api.uber.com";

const clientId = () => process.env["UBER_CLIENT_ID"] ?? "";
const clientSecret = () => process.env["UBER_CLIENT_SECRET"] ?? "";
const orgUuid = () => process.env["UBER_ORG_UUID"] ?? "";
const configured = () => Boolean(clientId() && clientSecret() && orgUuid());

/** Live rate from the shared fx module — approximate throughout. */
const toEurAmount = (amount: number, currency: string): number => {
  const rate = fxRate(currency.toUpperCase()) ?? 1;
  return Math.round(amount * rate * 100) / 100;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(`${AUTH_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "client_credentials",
      scope: "guests.trips",
    }),
  });
  if (!res.ok) throw new Error(`uber-auth-${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const bearer = await token();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "x-uber-organizationuuid": orgUuid(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Uber ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`uber-${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type ProductEstimate = {
  product_id: string;
  display_name?: string;
  fare_id?: string;
  fare?: { value?: number | string; currency_code?: string };
  pickup_estimate?: number;
};

const classFor = (name: string): RideQuote["vehicleClass"] => {
  const n = name.toLowerCase();
  if (n.includes("black") || n.includes("premier") || n.includes("lux")) return "premium";
  if (n.includes("xl") || n.includes("van")) return "van";
  if (n.includes("comfort")) return "comfort";
  return "standard";
};

/** A clean number only — never parsed from a "$13-16" style display range. */
const fareValue = (fare: ProductEstimate["fare"]): number | null => {
  if (fare?.value === undefined || fare.value === null) return null;
  const n =
    typeof fare.value === "number"
      ? fare.value
      : Number(String(fare.value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const coordsOf = (c: { lat: number; lon: number } | null) =>
  c ? { latitude: c.lat, longitude: c.lon } : null;

async function estimate(plan: RidePlan): Promise<AdapterResult<RideQuote[]>> {
  if (!configured()) return unavailable("missing-key");
  const pickup = coordsOf(plan.pickupCoords);
  const dropoff = coordsOf(plan.dropoffCoords);
  if (!pickup || !dropoff) return unavailable("no-availability");

  try {
    const json = await call<{ product_estimates?: ProductEstimate[] }>(
      "/v1/guests/trips/estimates",
      { method: "POST", body: JSON.stringify({ pickup, dropoff }) },
    );
    const quotes: RideQuote[] = [];
    for (const p of json.product_estimates ?? []) {
      const value = fareValue(p.fare);
      if (value === null || !p.fare_id) continue;
      const currency = p.fare?.currency_code ?? "EUR";
      quotes.push({
        provider: "uber",
        providerLabel: "Uber",
        vehicleClass: classFor(p.display_name ?? ""),
        pickupAt: plan.pickupAt,
        etaMinutes: typeof p.pickup_estimate === "number" ? p.pickup_estimate : null,
        netEur: toEurAmount(value, currency),
        currency,
        // Both ids are needed to book this exact product at this exact price.
        quoteRef: `${p.product_id}:${p.fare_id}`,
      });
    }
    if (!quotes.length) return unavailable("no-availability");
    return ok(quotes);
  } catch {
    return unavailable("no-availability");
  }
}

export const uberRides: RideAdapter = {
  id: "uber",
  label: "Uber",
  category: "rides",
  credentialName: "UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_ORG_UUID",
  isConfigured: configured,

  search: estimate,

  async quote(plan: RidePlan, quoteRef: string): Promise<AdapterResult<RideQuote>> {
    // Uber's estimate already is the bookable price — there is no separate
    // quote step, so this re-reads the same estimates and picks the product
    // the traveller chose rather than inventing a second call Uber has none
    // of.
    const found = await estimate(plan);
    if (found.status !== "ok") return found;
    const match = found.data.find((q) => q.quoteRef === quoteRef);
    return match ? ok(match) : unavailable("no-availability");
  },

  async book(
    plan: RidePlan,
    quoteRef: string,
    guest: RideGuest,
  ): Promise<AdapterResult<RideOrder>> {
    if (!configured()) return unavailable("missing-key");
    const [productId, fareId] = quoteRef.split(":");
    const pickup = coordsOf(plan.pickupCoords);
    const dropoff = coordsOf(plan.dropoffCoords);
    if (!productId || !fareId || !pickup || !dropoff) return unavailable("no-availability");

    try {
      const json = await call<{ request_id: string }>("/v1/guests/trips", {
        method: "POST",
        body: JSON.stringify({
          guest: {
            first_name: guest.givenName,
            last_name: guest.familyName,
            email: guest.email,
            phone_number: guest.phone,
          },
          pickup: { ...pickup, address: plan.pickupAddress },
          dropoff: { ...dropoff, address: plan.dropoffAddress },
          product_id: productId,
          fare_id: fareId,
        }),
      });
      return ok({ provider: "uber", reference: json.request_id, status: "confirmed" });
    } catch {
      return unavailable("no-availability");
    }
  },

  async cancel(reference: string): Promise<AdapterResult<{ cancelled: boolean }>> {
    if (!configured()) return unavailable("missing-key");
    try {
      await call(`/v1/guests/trips/${reference}`, { method: "DELETE" });
      return ok({ cancelled: true });
    } catch {
      return unavailable("no-availability");
    }
  },
};
