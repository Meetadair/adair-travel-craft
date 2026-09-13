/**
 * Airport coordinates for the cities we sell, so we can say honest things like
 * "the hotel is 20 minutes from the airport". City coordinates in cities.ts are
 * centre points; these are the runways.
 *
 * Unknown airport → null distance, and the advice that needs it is not shown.
 */
import { DEFAULT_PLANNING_RULES, transferMinutes } from "./backwards";

export const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  CDG: { lat: 49.0097, lon: 2.5479 },
  ORY: { lat: 48.7233, lon: 2.3794 },
  LHR: { lat: 51.47, lon: -0.4543 },
  LGW: { lat: 51.1537, lon: -0.1821 },
  STN: { lat: 51.885, lon: 0.235 },
  MXP: { lat: 45.6306, lon: 8.7281 },
  LIN: { lat: 45.4451, lon: 9.2767 },
  FCO: { lat: 41.8003, lon: 12.2389 },
  CIA: { lat: 41.7994, lon: 12.5949 },
  WAW: { lat: 52.1657, lon: 20.9671 },
  KRK: { lat: 50.0777, lon: 19.7848 },
  GDN: { lat: 54.3776, lon: 18.4662 },
  BER: { lat: 52.3667, lon: 13.5033 },
  FRA: { lat: 50.0379, lon: 8.5622 },
  MUC: { lat: 48.3537, lon: 11.775 },
  HAM: { lat: 53.6304, lon: 9.9882 },
  AMS: { lat: 52.3105, lon: 4.7683 },
  BRU: { lat: 50.9014, lon: 4.4844 },
  BCN: { lat: 41.2974, lon: 2.0833 },
  MAD: { lat: 40.4719, lon: -3.5626 },
  AGP: { lat: 36.6749, lon: -4.4991 },
  VLC: { lat: 39.4893, lon: -0.4816 },
  LIS: { lat: 38.7756, lon: -9.1354 },
  OPO: { lat: 41.2481, lon: -8.6814 },
  VIE: { lat: 48.1103, lon: 16.5697 },
  ZRH: { lat: 47.4647, lon: 8.5492 },
  GVA: { lat: 46.2381, lon: 6.1089 },
  CPH: { lat: 55.618, lon: 12.656 },
  ARN: { lat: 59.6519, lon: 17.9186 },
  OSL: { lat: 60.1976, lon: 11.1004 },
  HEL: { lat: 60.3172, lon: 24.9633 },
  DUB: { lat: 53.4213, lon: -6.2701 },
  EDI: { lat: 55.95, lon: -3.3725 },
  MAN: { lat: 53.3654, lon: -2.2725 },
  PRG: { lat: 50.1008, lon: 14.26 },
  BUD: { lat: 47.4369, lon: 19.2556 },
  ATH: { lat: 37.9364, lon: 23.9445 },
  IST: { lat: 41.2753, lon: 28.7519 },
  SAW: { lat: 40.8986, lon: 29.3092 },
  JFK: { lat: 40.6413, lon: -73.7781 },
  EWR: { lat: 40.6895, lon: -74.1745 },
  NRT: { lat: 35.7719, lon: 140.3928 },
  HND: { lat: 35.5494, lon: 139.7798 },
  DXB: { lat: 25.2532, lon: 55.3657 },
  RIX: { lat: 56.9236, lon: 23.9711 },
  VNO: { lat: 54.6341, lon: 25.2858 },
  TLL: { lat: 59.4133, lon: 24.8328 },
  BEG: { lat: 44.8184, lon: 20.309 },
  SOF: { lat: 42.6967, lon: 23.4114 },
  OTP: { lat: 44.5711, lon: 26.085 },
  ZAG: { lat: 45.7429, lon: 16.0688 },
  NCE: { lat: 43.6653, lon: 7.2151 },
  MRS: { lat: 43.4393, lon: 5.2214 },
  LYS: { lat: 45.7256, lon: 5.0811 },
  NAP: { lat: 40.8847, lon: 14.2908 },
  VCE: { lat: 45.5053, lon: 12.3519 },
  FLR: { lat: 43.81, lon: 11.2051 },
  PMI: { lat: 39.5517, lon: 2.7388 },
};

const R = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line kilometres between the airport and a point, or null. */
export function airportDistanceKm(
  iata: string,
  lat: number | null | undefined,
  lon: number | null | undefined,
): number | null {
  const airport = AIRPORT_COORDS[iata.toUpperCase()];
  if (!airport || typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const dLat = rad(lat - airport.lat);
  const dLon = rad(lon - airport.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(airport.lat)) * Math.cos(rad(lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Realistic door-to-door driving minutes for that distance. */
export function driveMinutes(km: number): number {
  return transferMinutes(km, DEFAULT_PLANNING_RULES);
}
