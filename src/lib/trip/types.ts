/** Shared shapes for the trip parse + search endpoints. */

/** One stop on the journey, in travel order. */
export type TripStop = {
  city: string;
  iata: string;
  lat: number;
  lon: number;
};

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
  /** A specific property the traveller named, e.g. "Hotel Milano Scala". */
  hotelNameExact: string | null;
  /** A specific car supplier or model, e.g. "Sixt" or "Tesla". */
  carNameExact: string | null;
  needsCar: boolean;
  invoiceToCompany: boolean;
  /** Ordered stops: origin first, then every destination named in the sentence. */
  stops: TripStop[];
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
  /** True when this property is the exact one the traveller named. */
  exact?: boolean;
};

export type CarResult = {
  supplier: string;
  vehicle: string;
  amount: number;
  currency: string;
  amountEur: number;
  approx: boolean;
  transmission: string;
  /** True when this car is the exact supplier/model the traveller named. */
  exact?: boolean;
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
  /** The named hotel we could not find, plus the closest options instead. */
  hotelRequested: string | null;
  hotelNotFound: boolean;
  hotelAlternatives: StayResult[];
  /** The named car supplier/model we could not find, plus close options. */
  carRequested: string | null;
  carNotFound: boolean;
  carAlternatives: CarResult[];
  /** Short note per failed part, e.g. { stays: "no availability" }. */
  errors: Partial<Record<"flights" | "stays" | "cars", string>>;
};


/** Nearby-date price comparison for the same trip (real searches only). */
export type PriceContext = {
  peak: boolean;
  ratio: number;
  requestedTotalEur: number;
  cheapestTotalEur: number;
  cheapestDepartDate: string | null;
  cheapestReturnDate: string | null;
  offsetDays: number | null;
  savingEur: number;
  eventName: string | null;
  city: string;
};
