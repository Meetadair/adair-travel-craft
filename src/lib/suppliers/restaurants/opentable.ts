/**
 * OpenTable restaurant adapter.
 *
 * Checked docs.opentable.com and the API-partners programme
 * (opentable.com/restaurant-solutions/api-partners) directly: there is no
 * third-party "search availability and create a reservation for someone
 * else" API here, credentials or not.
 *
 * - Authorization, Directory and Sync are the only documented API
 *   families, all partner-gated (application, ~3-4 week review, signed
 *   agreement — no self-serve key). Directory returns restaurant listings,
 *   but a reservation is a link back into OpenTable's own booking page, not
 *   a bookable object this adapter could complete. Sync is restaurant-side
 *   (pushes reservation/guest data into a POS/CRM) — the wrong direction.
 * - OpenTable's consumer terms separately disallow "robots, scrapers, and
 *   automated assistants" absent explicit authorisation, which a genuine
 *   book-on-behalf-of-the-traveller flow would need OpenTable to grant on
 *   top of the partner agreement.
 *
 * So this stays an honest stub — not a missing key away from working, the
 * way Uber or TheFork are. If OpenTable ever publishes a real third-party
 * booking API, wire it the same way uber.ts was; nothing outside this file
 * needs to change.
 */
import {
  unavailable,
  type AdapterResult,
  type RestaurantAdapter,
  type RestaurantCriteria,
  type RestaurantOffer,
  type RestaurantOrder,
} from "@/lib/suppliers/types";

const CREDENTIAL = "OPENTABLE_API_KEY";

const key = () => process.env[CREDENTIAL] ?? "";

export const openTableRestaurants: RestaurantAdapter = {
  id: "opentable",
  label: "OpenTable",
  category: "restaurants",
  credentialName: CREDENTIAL,
  isConfigured: () => Boolean(key()),

  async search(_criteria: RestaurantCriteria): Promise<AdapterResult<RestaurantOffer[]>> {
    if (!key()) return unavailable("missing-key");
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
