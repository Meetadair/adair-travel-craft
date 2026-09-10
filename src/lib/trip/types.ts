/** Shared shapes for the trip parse + search endpoints. */

export type TripRequest = {
  originCity: string;
  originIata: string;
  destinationCity: string;
  destinationIata: string;
  /** Destination centre coordinates, used for the stays search. */
  lat: number;
  lon: number;
  departDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  cabinClass: "economy" | "premium_economy" | "business" | "first";
  passengers: number;
  /** Free-text hotel wish, e.g. "near the Duomo". */
  hotelWish: string | null;
  needsCar: boolean;
  invoiceToCompany: boolean;
};

export type FlightResult = {
  carrier: string;
  flightNumbers: string[];
  departAt: string;
  arriveAt: string;
  returnDepartAt: string | null;
  cabin: string;
  amount: number;
  currency: string;
  amountEur: number;
  approx: boolean;
  offerId: string;
  expiresAt: string | null;
};

export type StayResult = {
  name: string;
  address: string;
  rating: number | null;
  nightlyAmount: number;
  amount: number;
  currency: string;
  amountEur: number;
  approx: boolean;
  photoUrl: string | null;
  rateId: string | null;
};

export type CarResult = {
  supplier: string;
  vehicle: string;
  amount: number;
  currency: string;
  amountEur: number;
  approx: boolean;
  transmission: string;
};

export type TripSearchResponse = {
  request: TripRequest;
  flight: FlightResult | null;
  stay: StayResult | null;
  car: CarResult | null;
  totalEur: number;
  approx: boolean;
  savedEur: number;
  savedMinutes: number;
  testMode: boolean;
  /** Short note per failed part, e.g. { stays: "no availability" }. */
  errors: Partial<Record<"flights" | "stays" | "cars", string>>;
};
