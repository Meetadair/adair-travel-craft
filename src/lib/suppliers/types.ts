/**
 * One shared shape per supplier category, so a provider can be connected
 * later by editing only its own adapter file.
 *
 * Every call returns either live data or an honest `unavailable` state — an
 * adapter must never invent a venue, a driver, a time or a price.
 */

export type SupplierCategory = "rides" | "restaurants";

export type UnavailableReason =
  /** No credential for this provider in the environment. */
  | "missing-key"
  /** Switched off in the `providers` table. */
  | "disabled"
  /** Nothing enabled for this category at all. */
  | "no-provider"
  /** Key present, live API wiring still to come. */
  | "not-connected"
  /** Provider answered, but had nothing for this request. */
  | "no-availability";

export type Unavailable = { status: "unavailable"; reason: UnavailableReason };
export type Ok<T> = { status: "ok"; data: T };
export type AdapterResult<T> = Ok<T> | Unavailable;

export const ok = <T,>(data: T): Ok<T> => ({ status: "ok", data });
export const unavailable = (reason: UnavailableReason): Unavailable => ({
  status: "unavailable",
  reason,
});

/* ------------------------------------------------------------------ rides */

export type RideClass = "standard" | "comfort" | "van" | "premium";
export type RideLeg = "arrival" | "departure";

/** Pickup and drop-off derived from the itinerary — never from a supplier. */
export type RidePlan = {
  leg: RideLeg;
  label: string;
  pickupAddress: string;
  dropoffAddress: string;
  /** Local "YYYY-MM-DDTHH:mm". */
  pickupAt: string;
  passengers: number;
};

export type RideQuote = {
  provider: string;
  providerLabel: string;
  vehicleClass: RideClass;
  pickupAt: string;
  etaMinutes: number | null;
  /** Supplier net price; the app adds the `ride` markup on top. */
  netEur: number;
  currency: string;
  quoteRef: string;
};

export type RideOrder = {
  provider: string;
  reference: string;
  status: "confirmed";
};

export interface RideAdapter {
  id: string;
  label: string;
  category: "rides";
  credentialName: string;
  isConfigured(): boolean;
  search(plan: RidePlan): Promise<AdapterResult<RideQuote[]>>;
  quote(plan: RidePlan, quoteRef: string): Promise<AdapterResult<RideQuote>>;
  book(plan: RidePlan, quoteRef: string): Promise<AdapterResult<RideOrder>>;
  cancel(reference: string): Promise<AdapterResult<{ cancelled: boolean }>>;
}

/* ------------------------------------------------------------ restaurants */

/** What the traveller's profile asks for on a given evening. */
export type RestaurantCriteria = {
  city: string;
  lat: number | null;
  lon: number | null;
  /** "YYYY-MM-DD". */
  date: string;
  /** "HH:mm". */
  time: string;
  partySize: number;
  cuisines: string[];
  diets: string[];
  interests: string[];
  maxKm: number | null;
  budgetBand: string | null;
};

export type RestaurantOffer = {
  provider: string;
  providerLabel: string;
  name: string;
  cuisine: string | null;
  distanceKm: number | null;
  date: string;
  time: string;
  partySize: number;
  /** Only set when the venue requires a prepayment. */
  prepaymentEur: number | null;
  currency: string;
  offerRef: string;
};

export type RestaurantOrder = {
  provider: string;
  reference: string;
  status: "confirmed";
};

export interface RestaurantAdapter {
  id: string;
  label: string;
  category: "restaurants";
  credentialName: string;
  isConfigured(): boolean;
  search(criteria: RestaurantCriteria): Promise<AdapterResult<RestaurantOffer[]>>;
  quote(criteria: RestaurantCriteria, offerRef: string): Promise<AdapterResult<RestaurantOffer>>;
  book(criteria: RestaurantCriteria, offerRef: string): Promise<AdapterResult<RestaurantOrder>>;
  cancel(reference: string): Promise<AdapterResult<{ cancelled: boolean }>>;
}

export type AnyAdapter = RideAdapter | RestaurantAdapter;
