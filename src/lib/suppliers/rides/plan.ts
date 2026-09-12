/**
 * Airport transfers derived from the itinerary alone: pickup, drop-off and
 * time come from the flight and the hotel, never from a supplier.
 */
import type { TripSearchResponse } from "@/lib/trip/types";
import type { RidePlan } from "@/lib/suppliers/types";

const shift = (iso: string, minutes: number) =>
  new Date(Date.parse(iso) + minutes * 60_000).toISOString().slice(0, 16);

const airportLabel = (iata: string, city: string) => `${city} airport (${iata})`;

export function ridePlansFor(search: TripSearchResponse): RidePlan[] {
  const { request, flight, stay } = search;
  if (!flight) return [];

  const passengers = Math.max(1, request.passengers);
  const hotel = stay ? `${stay.name}, ${stay.address}` : `${request.destinationCity} centre`;
  const airport = airportLabel(request.destinationIata, request.destinationCity);
  const plans: RidePlan[] = [];

  plans.push({
    leg: "arrival",
    label: "Airport → hotel",
    pickupAddress: airport,
    dropoffAddress: hotel,
    // Enough time to clear the terminal after the scheduled arrival.
    pickupAt: shift(flight.arriveAt, 45),
    passengers,
  });

  const departure = flight.returnDepartAt
    ? shift(flight.returnDepartAt, -180)
    : `${request.returnDate}T10:00`;
  plans.push({
    leg: "departure",
    label: "Hotel → airport",
    pickupAddress: hotel,
    dropoffAddress: airport,
    pickupAt: departure,
    passengers,
  });

  return plans;
}
