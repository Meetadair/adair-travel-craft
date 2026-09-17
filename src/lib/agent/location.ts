/**
 * Where the traveller is, in the least intrusive way that answers the question.
 *
 * Three levels, in order: the city of the trip, the hotel they are booked into,
 * and — only with consent, only when the question truly needs it — the device.
 * Every answer carries its source so Adair can word it honestly, and no
 * coordinate is ever written down: it is used for the reply and discarded.
 */

export type LocationConsent = "granted" | "denied" | "not_asked";

export const LOCATION_CONSENTS: LocationConsent[] = ["granted", "denied", "not_asked"];

export function asConsent(value: unknown): LocationConsent {
  return LOCATION_CONSENTS.includes(value as LocationConsent)
    ? (value as LocationConsent)
    : "not_asked";
}

export type Coords = { lat: number; lon: number };

export type LocationInputs = {
  /** Sent by the browser for this one request. Never stored. */
  device: Coords | null;
  consent: LocationConsent;
  hotel: ({ name: string } & Coords) | null;
  city: ({ name: string } & Coords) | null;
};

export type LocationSource = "device" | "hotel" | "city" | "none";

export type ResolvedLocation = {
  source: LocationSource;
  label: string | null;
  lat: number | null;
  lon: number | null;
  /** True when precise position would help and we are allowed to ask for it. */
  askConsent: boolean;
  consent: LocationConsent;
};

/**
 * Resolve the best origin available right now.
 *
 * `precise` is true when the traveller asked something that only exact position
 * can answer ("what is near me"). Only then may we ask for permission, and only
 * when they have not already said no.
 */
export function resolveLocation(inputs: LocationInputs, precise = false): ResolvedLocation {
  const { device, consent, hotel, city } = inputs;

  if (device && consent === "granted") {
    return {
      source: "device",
      label: null,
      lat: device.lat,
      lon: device.lon,
      askConsent: false,
      consent,
    };
  }

  // We only ask when precision is the point of the question, and never twice
  // after a refusal.
  const askConsent = precise && consent === "not_asked";

  if (hotel) {
    return {
      source: "hotel",
      label: hotel.name,
      lat: hotel.lat,
      lon: hotel.lon,
      askConsent,
      consent,
    };
  }
  if (city) {
    return {
      source: "city",
      label: city.name,
      lat: city.lat,
      lon: city.lon,
      askConsent,
      consent,
    };
  }
  return { source: "none", label: null, lat: null, lon: null, askConsent, consent };
}

/** How Adair should describe the origin it used, in one clause. */
export function originClause(resolved: ResolvedLocation): string {
  switch (resolved.source) {
    case "device":
      return "from where you are standing";
    case "hotel":
      return `from your hotel${resolved.label ? ` (${resolved.label})` : ""}`;
    case "city":
      return `from the centre of ${resolved.label ?? "the city"}`;
    default:
      return "from no known starting point";
  }
}
