/**
 * Bolt rides adapter.
 *
 * Unlike Uber, Bolt has no public self-serve booking API: "Ride Booker"
 * (Bolt for Business) is a human-operated web dashboard only — its own
 * support docs describe clicking through a webpage, with no mention of an
 * API, key, or programmatic access anywhere. A browser-based "Bolt Web"
 * product also exists for requesting a ride without the app, but its exact
 * URL parameters for a pre-filled pickup/dropoff aren't published anywhere
 * checked, so this stays an honest stub rather than a deep link that might
 * silently 404 or land on the wrong page. If Bolt opens a partner API later,
 * or its dashboard exposes an API key, replace the bodies of
 * search/quote/book/cancel below the same way uber.ts was — nothing outside
 * this file needs to change.
 */
import {
  unavailable,
  type AdapterResult,
  type RideAdapter,
  type RideGuest,
  type RideOrder,
  type RidePlan,
  type RideQuote,
} from "@/lib/suppliers/types";

const CREDENTIAL = "BOLT_API_KEY";

const key = () => process.env[CREDENTIAL] ?? "";

export const boltRides: RideAdapter = {
  id: "bolt",
  label: "Bolt",
  category: "rides",
  credentialName: CREDENTIAL,
  isConfigured: () => Boolean(key()),

  async search(_plan: RidePlan): Promise<AdapterResult<RideQuote[]>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async quote(_plan: RidePlan, _quoteRef: string): Promise<AdapterResult<RideQuote>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async book(
    _plan: RidePlan,
    _quoteRef: string,
    _guest: RideGuest,
  ): Promise<AdapterResult<RideOrder>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async cancel(_reference: string): Promise<AdapterResult<{ cancelled: boolean }>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },
};
