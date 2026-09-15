/**
 * TheFork restaurant adapter.
 *
 * TheFork (thefork.com, TripAdvisor's European reservation subsidiary) does
 * have a real, documented REST API for creating and managing bookings —
 * see docs.thefork.io. But two things gate it, not just a missing key:
 *
 * 1. Access isn't self-serve. A client_id/client_secret pair only shows up
 *    after emailing integrations@thefork.com with the use case and getting
 *    approved as a connectivity partner — there's no sign-up form. Until
 *    Adair has that pair (THEFORK_CLIENT_ID, THEFORK_CLIENT_SECRET),
 *    isConfigured() stays false.
 *
 * 2. Even with credentials, this API can't do what search() needs. Every
 *    endpoint is scoped to a restaurant TheFork already knows the UUID of —
 *    GET /v1/restaurants/{id}/availabilities, /timeslots, /offers, POST
 *    /v1/restaurants/{id}/reservations — there is no "restaurants near this
 *    city/coordinate" endpoint anywhere in the schema
 *    (api.thefork.io/manager/openapi.json). It's built for a restaurant's
 *    own booking widget, not for a third party discovering venues. So
 *    RestaurantCriteria (city/lat/lon, no restaurant id) can't drive a real
 *    search here until Adair also has some other source of TheFork
 *    restaurant UUIDs per venue — the same missing piece that stalled the
 *    Michelin-recommendations idea. Credentials alone would only unlock
 *    quote/book for a restaurant id Adair doesn't have a way to find yet.
 *
 * Auth, once both are solved (developer.thefork.io / docs.thefork.io):
 *   token → POST https://auth.thefork.io/oauth/token
 *           (grant_type=client_credentials, audience=https://api.thefork.io)
 *   base  → https://api.thefork.io/manager
 *   book  → POST /v1/restaurants/{id}/reservations
 */
import {
  unavailable,
  type AdapterResult,
  type RestaurantAdapter,
  type RestaurantCriteria,
  type RestaurantOffer,
  type RestaurantOrder,
} from "@/lib/suppliers/types";

const clientId = () => process.env["THEFORK_CLIENT_ID"] ?? "";
const clientSecret = () => process.env["THEFORK_CLIENT_SECRET"] ?? "";
const configured = () => Boolean(clientId() && clientSecret());

export const theForkRestaurants: RestaurantAdapter = {
  id: "thefork",
  label: "TheFork",
  category: "restaurants",
  credentialName: "THEFORK_CLIENT_ID, THEFORK_CLIENT_SECRET",
  isConfigured: configured,

  async search(_criteria: RestaurantCriteria): Promise<AdapterResult<RestaurantOffer[]>> {
    if (!configured()) return unavailable("missing-key");
    // Blocked on more than the key — see file header. No restaurant-id
    // directory to search against yet, so there is nothing honest to return.
    return unavailable("not-connected");
  },

  async quote(
    _criteria: RestaurantCriteria,
    _offerRef: string,
  ): Promise<AdapterResult<RestaurantOffer>> {
    if (!configured()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async book(
    _criteria: RestaurantCriteria,
    _offerRef: string,
  ): Promise<AdapterResult<RestaurantOrder>> {
    if (!configured()) return unavailable("missing-key");
    return unavailable("not-connected");
  },

  async cancel(_reference: string): Promise<AdapterResult<{ cancelled: boolean }>> {
    if (!configured()) return unavailable("missing-key");
    return unavailable("not-connected");
  },
};
