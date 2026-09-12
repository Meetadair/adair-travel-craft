/**
 * TheFork restaurant adapter.
 *
 * To connect: replace the bodies of search/quote/book/cancel with calls to
 * TheFork's API using `key`. Nothing outside this file needs to change.
 */
import {
  unavailable,
  type AdapterResult,
  type RestaurantAdapter,
  type RestaurantCriteria,
  type RestaurantOffer,
  type RestaurantOrder,
} from "@/lib/suppliers/types";

const CREDENTIAL = "THEFORK_API_KEY";

const key = () => process.env[CREDENTIAL] ?? "";

export const theForkRestaurants: RestaurantAdapter = {
  id: "thefork",
  label: "TheFork",
  category: "restaurants",
  credentialName: CREDENTIAL,
  isConfigured: () => Boolean(key()),

  async search(_criteria: RestaurantCriteria): Promise<AdapterResult<RestaurantOffer[]>> {
    if (!key()) return unavailable("missing-key");
    // TODO: availability search by city/coordinates, date, time and party size.
    return unavailable("not-connected");
  },

  async quote(
    _criteria: RestaurantCriteria,
    _offerRef: string,
  ): Promise<AdapterResult<RestaurantOffer>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async book(
    _criteria: RestaurantCriteria,
    _offerRef: string,
  ): Promise<AdapterResult<RestaurantOrder>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async cancel(_reference: string): Promise<AdapterResult<{ cancelled: boolean }>> {
    if (!key()) return unavailable("missing-key");
    return unavailable("not-connected");
  },
};
