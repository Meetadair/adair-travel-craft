/**
 * Bolt rides adapter.
 *
 * To connect: replace the bodies of search/quote/book/cancel with calls to
 * Bolt's partner API using `key`. Nothing outside this file needs to change.
 */
import {
  unavailable,
  type AdapterResult,
  type RideAdapter,
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
    // TODO: request ride estimates for the pickup/dropoff pair.
    return unavailable("not-connected");
  },

  async quote(_plan: RidePlan, _quoteRef: string): Promise<AdapterResult<RideQuote>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async book(_plan: RidePlan, _quoteRef: string): Promise<AdapterResult<RideOrder>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async cancel(_reference: string): Promise<AdapterResult<{ cancelled: boolean }>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },
};
