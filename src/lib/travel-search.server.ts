/**
 * Server-only travel provider access.
 * Flights: Duffel (preferred) or Amadeus. Hotels: Duffel Stays, then Amadeus.
 * Cars: Amadeus
 * transfer/car estimate. When credentials are missing we fall back to clearly
 * flagged sample data so the concept demo keeps working.
 */

import { buildFlightOptions, type FlightOptions } from "@/lib/trip/flight-options";
import type { StayResult, TripRequest } from "@/lib/trip/types";

import { bestSaving, flexWindows, type FlexSaving } from "@/lib/trip/flex";
import { duffelPassengers, headCount, type PartyCounts } from "@/lib/trip/party-counts";

/** Everyone on the booking, lap infants included — a room counts people. */
const headOf = (party: PartyCounts) => headCount(party);

export type TripOffer = {
  kind: "flight" | "hotel" | "car";
  title: string;
  detail: string;
  provider: string;
  offerReference: string;
  amount: number;
  currency: string;
  live: boolean;
  /** Optional provider photos (empty when the provider exposes none). */
  images?: string[];
  /** liteAPI's hotel id (hotels only) — lets the card fetch room options and reviews. */
  hotelId?: string | null;
  /** Optional swap-in options (hotels): shown only on demand. */
  alternatives?: Array<Omit<TripOffer, "alternatives">>;
  /**
   * Flights only: two or three options with the trade-off spelled out — the
   * fare difference, and what each choice costs after booking. Built
   * server-side, where the bags and fare conditions live.
   */
  flightChoice?: FlightOptions;
};

export type TripSearchInput = {
  originCity: string;
  originIata: string;
  destinationCity: string;
  destinationIata: string;
  departDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  cabinClass?: string;
  needsCar?: boolean;
  notes?: string;
  /** Flight only, one direction. Set from the sentence, never guessed. */
  oneWay?: boolean;
  /** Days either side the traveller said they could move. 0 or absent = fixed. */
  flexDays?: number;
  /** Who is flying, when the traveller has said. Absent means one adult. */
  party?: PartyCounts;
};

export type TripSearchResult = {
  offers: TripOffer[];
  total: number;
  currency: string;
  source: "live" | "partial" | "demo";
  warnings: string[];
  /** Present only when the traveller said they were flexible and it paid off. */
  flexSaving?: FlexSaving;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Prices the same flight on the nearby days the traveller said they could move
 * to. Flight only: the hotel follows the flight, and re-pricing the whole trip
 * six times to answer "is it cheaper on Tuesday" is not worth the wait.
 *
 * Every call is allowed to fail on its own. A flexible search that breaks the
 * ordinary one would be a poor trade for a hint.
 */
async function flexibleSaving(
  input: TripSearchInput,
  baseFlight: TripOffer,
): Promise<FlexSaving | null> {
  const today = new Date().toISOString().slice(0, 10);
  const windows = flexWindows(
    input.departDate,
    input.oneWay ? undefined : input.returnDate,
    input.flexDays ?? 0,
    today,
  ).slice(0, 4); // four extra calls is the most a traveller will wait for

  if (windows.length === 0) return null;

  const priced = await Promise.all(
    windows.map(async (window) => {
      try {
        const offer = await duffelFlight({
          ...input,
          departDate: window.departDate,
          returnDate: window.returnDate ?? window.departDate,
        });
        if (!offer || !offer.live) return null;
        return { window, amount: offer.amount, currency: offer.currency };
      } catch {
        return null;
      }
    }),
  );

  return bestSaving(
    baseFlight.amount,
    baseFlight.currency,
    priced.filter((p): p is NonNullable<typeof p> => p !== null),
  );
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

/* ---------------- Duffel: flights ---------------- */

/**
 * Flights through the richer Duffel module: bags, fare conditions and refund
 * penalties come back with each offer, so the card can show a choice with the
 * trade-off spelled out instead of one bare price.
 */
async function duffelFlightWithChoice(input: TripSearchInput): Promise<TripOffer | null> {
  const { hasDuffelKey, searchFlight } = await import("@/lib/trip/duffel.server");
  if (!hasDuffelKey()) return null;

  const request: TripRequest = {
    originCity: input.originCity,
    originIata: input.originIata,
    originStated: true,
    destinationCity: input.destinationCity,
    destinationIata: input.destinationIata,
    lat: 0,
    lon: 0,
    departDate: input.departDate,
    returnDate: input.returnDate,
    cabinClass:
      input.cabinClass === "business" ||
      input.cabinClass === "first" ||
      input.cabinClass === "premium_economy"
        ? input.cabinClass
        : "economy",
    passengers: input.party ? headOf(input.party) : 1,
    hotelWish: null,
    hotelNameExact: null,
    carNameExact: null,
    invoiceToCompany: false,
    needsCar: false,
    stops: [],
    ...(input.oneWay ? { oneWay: true as const } : {}),
  };

  const found = await searchFlight(request);
  if (!found) return null;

  const { flight, alternatives } = found;
  const choice = buildFlightOptions(flight, alternatives);

  const seg = `${input.originIata} → ${flight.destinationIata ?? input.destinationIata}`;
  const dep = flight.departAt.slice(11, 16);
  const arr = flight.arriveAt.slice(11, 16);

  return {
    kind: "flight",
    title: `${flight.carrier} ${flight.flightNumbers[0] ?? ""} · ${seg}`.trim(),
    detail: `Departure ${fmtDate(input.departDate)} ${dep} – ${arr} · return ${fmtDate(input.returnDate)} · ${flight.cabin.replace("_", " ")}`,
    provider: "Duffel",
    offerReference: flight.offerId,
    amount: round(flight.amount),
    currency: flight.currency,
    live: true,
    ...(choice.options.length > 1 ? { flightChoice: choice } : {}),
  };
}

async function duffelFlight(input: TripSearchInput): Promise<TripOffer | null> {
  // The rest of the codebase reads DUFFEL_API_KEY; the older name stays as a fallback.
  const token = process.env["DUFFEL_API_KEY"] ?? process.env["DUFFEL_ACCESS_TOKEN"];
  if (!token) return null;

  const cabin =
    input.cabinClass === "business"
      ? "business"
      : input.cabinClass === "premium_economy"
        ? "premium_economy"
        : "economy";

  const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: input.oneWay
          ? [
              {
                origin: input.originIata,
                destination: input.destinationIata,
                departure_date: input.departDate,
              },
            ]
          : [
              {
                origin: input.originIata,
                destination: input.destinationIata,
                departure_date: input.departDate,
              },
              {
                origin: input.destinationIata,
                destination: input.originIata,
                departure_date: input.returnDate,
              },
            ],
        // One entry per person, not a head count: the fare depends on who.
        passengers: input.party ? duffelPassengers(input.party) : [{ type: "adult" }],
        cabin_class: cabin,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Duffel offer_requests failed [${res.status}]: ${body}`);
    throw new Error(`Duffel [${res.status}]`);
  }

  const json = (await res.json()) as {
    data?: {
      offers?: Array<{
        id: string;
        total_amount: string;
        total_currency: string;
        owner?: { name?: string };
        slices?: Array<{
          segments?: Array<{
            marketing_carrier?: { name?: string; iata_code?: string };
            marketing_carrier_flight_number?: string;
            departing_at?: string;
            arriving_at?: string;
          }>;
        }>;
      }>;
    };
  };

  const offers = json.data?.offers ?? [];
  if (!offers.length) return null;
  const best = offers.slice().sort((a, b) => Number(a.total_amount) - Number(b.total_amount))[0]!;

  const seg = best.slices?.[0]?.segments?.[0];
  const carrier = seg?.marketing_carrier?.name ?? best.owner?.name ?? "Carrier";
  const flightNo = `${seg?.marketing_carrier?.iata_code ?? ""}${seg?.marketing_carrier_flight_number ?? ""}`;
  const dep = seg?.departing_at?.slice(11, 16) ?? "";
  const arr = seg?.arriving_at?.slice(11, 16) ?? "";

  return {
    kind: "flight",
    title: `${carrier} ${flightNo} · ${input.originIata} → ${input.destinationIata}`.trim(),
    detail: `Departure ${fmtDate(input.departDate)} ${dep} – ${arr} · return ${fmtDate(input.returnDate)} · ${cabin.replace("_", " ")}`,
    provider: "Duffel",
    offerReference: best.id,
    amount: round(Number(best.total_amount)),
    currency: best.total_currency,
    live: true,
  };
}

/* ---------------- Amadeus ---------------- */

/**
 * Hotels from Duffel Stays — the supplier we actually book through.
 *
 * Returns null instead of throwing whenever the product is switched off on the
 * account, the destination has no centre coordinates, or the search comes back
 * empty, so the card falls through to Amadeus and then to flagged sample data
 * exactly as it did before. Nothing here can empty the trip card.
 */
async function duffelStay(input: TripSearchInput): Promise<TripOffer | null> {
  const token = process.env["DUFFEL_API_KEY"] ?? process.env["DUFFEL_ACCESS_TOKEN"];
  if (!token) return null;

  // Stays are searched by coordinates, not by airport code: take the city
  // centre, because a hotel by the runway is not what anyone asked for.
  const { CITIES } = await import("@/lib/trip/cities");
  const iata = input.destinationIata.trim().toUpperCase();
  const named = input.destinationCity.trim().toLowerCase();
  const city =
    CITIES.find((c) => c.iata === iata) ??
    CITIES.find((c) => c.city.toLowerCase() === named || c.aliases.includes(named));
  if (!city) return null;

  const request: TripRequest = {
    originCity: input.originCity,
    originIata: input.originIata,
    originStated: true,
    destinationCity: input.destinationCity,
    destinationIata: input.destinationIata,
    lat: city.lat,
    lon: city.lon,
    departDate: input.departDate,
    returnDate: input.returnDate,
    cabinClass: "economy",
    passengers: input.party ? headOf(input.party) : 1,
    hotelWish: input.notes?.trim() || null,
    hotelNameExact: null,
    carNameExact: null,
    needsCar: Boolean(input.needsCar),
    invoiceToCompany: false,
    stops: [{ city: city.city, iata: city.iata, lat: city.lat, lon: city.lon }],
  };

  const nights = Math.max(
    1,
    Math.round((Date.parse(input.returnDate) - Date.parse(input.departDate)) / 86_400_000),
  );

  const toOffer = (stay: StayResult): Omit<TripOffer, "alternatives"> => ({
    kind: "hotel",
    title: stay.name,
    detail: `${nights} ${nights === 1 ? "night" : "nights"} \u00b7 check-in ${fmtDate(
      input.departDate,
    )} \u00b7 ${stay.address || input.destinationCity}`,
    provider: "Duffel",
    offerReference: stay.rateId ?? `DF-ST-${stay.name}`,
    amount: round(stay.amount),
    currency: stay.currency,
    live: true,
    ...(stay.photoUrl ? { images: [stay.photoUrl] } : {}),
    ...(stay.hotelId ? { hotelId: stay.hotelId } : {}),
  });

  try {
    const { searchStay } = await import("@/lib/trip/duffel.server");
    const outcome = await searchStay(request);
    if (!outcome.stay) return null;

    const alternatives = outcome.alternatives.slice(0, 3).map(toOffer);
    return { ...toOffer(outcome.stay), ...(alternatives.length ? { alternatives } : {}) };
  } catch (error) {
    const { isProductDisabled } = await import("@/lib/trip/duffel-stays.server");
    if (isProductDisabled(error)) {
      // Not a failure: this account cannot sell stays yet. Said once, quietly.
      console.info("Duffel Stays is not enabled on this account - hotel falls back to sample.");
      return null;
    }
    console.error("Duffel stays search failed", error);
    return null;
  }
}

async function amadeusToken(): Promise<string | null> {
  const id = process.env["AMADEUS_CLIENT_ID"];
  const secret = process.env["AMADEUS_CLIENT_SECRET"];
  if (!id || !secret) return null;

  const res = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) {
    console.error(`Amadeus token failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function amadeusFlight(input: TripSearchInput, token: string): Promise<TripOffer | null> {
  const params = new URLSearchParams({
    originLocationCode: input.originIata,
    destinationLocationCode: input.destinationIata,
    departureDate: input.departDate,
    returnDate: input.returnDate,
    adults: "1",
    currencyCode: "EUR",
    max: "5",
  });
  const res = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error(`Amadeus flight-offers failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      price?: { total?: string; currency?: string };
      validatingAirlineCodes?: string[];
      itineraries?: Array<{
        segments?: Array<{
          carrierCode?: string;
          number?: string;
          departure?: { at?: string };
          arrival?: { at?: string };
        }>;
      }>;
    }>;
  };
  const best = json.data?.[0];
  if (!best) return null;
  const seg = best.itineraries?.[0]?.segments?.[0];
  return {
    kind: "flight",
    title:
      `${seg?.carrierCode ?? ""} ${seg?.number ?? ""} · ${input.originIata} → ${input.destinationIata}`.trim(),
    detail: `Departure ${fmtDate(input.departDate)} ${seg?.departure?.at?.slice(11, 16) ?? ""} – ${seg?.arrival?.at?.slice(11, 16) ?? ""} · return ${fmtDate(input.returnDate)}`,
    provider: "Amadeus",
    offerReference: `AM-FL-${best.id}`,
    amount: round(Number(best.price?.total ?? 0)),
    currency: best.price?.currency ?? "EUR",
    live: true,
  };
}

async function amadeusHotel(input: TripSearchInput, token: string): Promise<TripOffer | null> {
  const cityRes = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city?cityCode=${encodeURIComponent(
      input.destinationIata,
    )}&radius=20&radiusUnit=KM&hotelSource=ALL`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!cityRes.ok) {
    console.error(`Amadeus hotels by-city failed [${cityRes.status}]: ${await cityRes.text()}`);
    return null;
  }
  const cityJson = (await cityRes.json()) as {
    data?: Array<{ hotelId?: string; name?: string }>;
  };
  const hotels = (cityJson.data ?? []).filter((h) => h.hotelId).slice(0, 12);
  if (!hotels.length) return null;

  const params = new URLSearchParams({
    hotelIds: hotels.map((h) => h.hotelId!).join(","),
    checkInDate: input.departDate,
    checkOutDate: input.returnDate,
    adults: "1",
    currency: "EUR",
    bestRateOnly: "true",
  });
  const offerRes = await fetch(
    `https://test.api.amadeus.com/v3/shopping/hotel-offers?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!offerRes.ok) {
    console.error(`Amadeus hotel-offers failed [${offerRes.status}]: ${await offerRes.text()}`);
    return null;
  }
  const offerJson = (await offerRes.json()) as {
    data?: Array<{
      hotel?: { name?: string; hotelId?: string };
      offers?: Array<{
        id?: string;
        price?: { total?: string; currency?: string };
        room?: { typeEstimated?: { category?: string; beds?: number } };
      }>;
    }>;
  };
  const candidates = (offerJson.data ?? []).flatMap((h) =>
    (h.offers ?? []).map((o) => ({ hotel: h.hotel, offer: o })),
  );
  if (!candidates.length) return null;
  const best = candidates.sort(
    (a, b) => Number(a.offer.price?.total ?? 0) - Number(b.offer.price?.total ?? 0),
  )[0]!;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.returnDate).getTime() - new Date(input.departDate).getTime()) / 86_400_000,
    ),
  );

  const toOffer = (c: (typeof candidates)[number]): Omit<TripOffer, "alternatives"> => ({
    kind: "hotel",
    title: c.hotel?.name ?? "Hotel",
    detail: `${nights} ${nights === 1 ? "night" : "nights"} · check-in ${fmtDate(input.departDate)} · ${input.destinationCity}`,
    provider: "Amadeus",
    offerReference: c.offer.id ?? `AM-HT-${c.hotel?.hotelId ?? ""}`,
    amount: round(Number(c.offer.price?.total ?? 0)),
    currency: c.offer.price?.currency ?? "EUR",
    live: true,
  });

  const seen = new Set<string>();
  const alternatives = candidates
    .filter((c) => {
      const key = c.hotel?.hotelId ?? c.hotel?.name ?? "";
      if (key === (best.hotel?.hotelId ?? best.hotel?.name ?? "") || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map(toOffer);

  return { ...toOffer(best), ...(alternatives.length ? { alternatives } : {}) };
}

/* ---------------- Sample fallbacks ---------------- */

function demoOffers(input: TripSearchInput): TripOffer[] {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.returnDate).getTime() - new Date(input.departDate).getTime()) / 86_400_000,
    ),
  );
  const offers: TripOffer[] = [
    {
      kind: "flight",
      title: `Flight ${input.originIata} → ${input.destinationIata}`,
      detail: `Departure ${fmtDate(input.departDate)} · return ${fmtDate(input.returnDate)} · sample data`,
      provider: "sample",
      offerReference: "SAMPLE-FLIGHT",
      amount: 412,
      currency: "EUR",
      live: false,
    },
    {
      kind: "hotel",
      title: `Downtown hotel · ${input.destinationCity}`,
      detail: `${nights} ${nights === 1 ? "night" : "nights"} · negotiated rate · sample data`,
      provider: "sample",
      offerReference: "SAMPLE-HOTEL",
      amount: 305 * nights,
      currency: "EUR",
      live: false,
      alternatives: [
        {
          kind: "hotel",
          title: `Design hotel · ${input.destinationCity}`,
          detail: `${nights} ${nights === 1 ? "night" : "nights"} · 8 min from downtown · sample data`,
          provider: "sample",
          offerReference: "SAMPLE-HOTEL-2",
          amount: 248 * nights,
          currency: "EUR",
          live: false,
        },
        {
          kind: "hotel",
          title: `Station-side hotel · ${input.destinationCity}`,
          detail: `${nights} ${nights === 1 ? "night" : "nights"} · cheapest option · sample data`,
          provider: "sample",
          offerReference: "SAMPLE-HOTEL-3",
          amount: 179 * nights,
          currency: "EUR",
          live: false,
        },
        {
          kind: "hotel",
          title: `5-star hotel with a view · ${input.destinationCity}`,
          detail: `${nights} ${nights === 1 ? "night" : "nights"} · corner room · sample data`,
          provider: "sample",
          offerReference: "SAMPLE-HOTEL-4",
          amount: 420 * nights,
          currency: "EUR",
          live: false,
        },
      ],
    },
  ];
  if (input.needsCar !== false) {
    offers.push({
      kind: "car",
      title: `Car · pickup ${input.destinationIata}`,
      detail: `${fmtDate(input.departDate)} – ${fmtDate(input.returnDate)} · automatic, full insurance · sample data`,
      provider: "sample",
      offerReference: "SAMPLE-CAR",
      amount: 109 * nights,
      currency: "EUR",
      live: false,
    });
  }
  return offers;
}

/* ---------------- Orchestration ---------------- */

export async function searchTrip(input: TripSearchInput): Promise<TripSearchResult> {
  const warnings: string[] = [];
  const offers: TripOffer[] = [];

  let flight: TripOffer | null = null;
  try {
    // The rich path first; the thin one stays as the fallback so a Duffel
    // hiccup never empties the card.
    flight = (await duffelFlightWithChoice(input).catch(() => null)) ?? (await duffelFlight(input));
  } catch {
    warnings.push("No live flight offers came back — showing a sample value.");
  }

  const token = await amadeusToken();
  if (!token && !flight) {
    warnings.push("Live search is not switched on yet — the card contains sample data.");
  }

  if (!flight && token) {
    flight = await amadeusFlight(input, token);
    if (!flight) warnings.push("No flights available from the API for these dates.");
  }

  // A one-way is a flight and nothing else: with no return date there is no
  // span to book a hotel or a car against, and inventing one would be a lie.
  if (input.oneWay) {
    const demoFlight = demoOffers(input).find((o) => o.kind === "flight")!;
    const only = flight ?? demoFlight;
    const flexOneWay = only.live ? await flexibleSaving(input, only).catch(() => null) : null;
    return {
      offers: [only],
      total: round(only.amount),
      currency: only.currency,
      source: only.live ? "live" : "demo",
      warnings,
      ...(flexOneWay ? { flexSaving: flexOneWay } : {}),
    };
  }

  // Duffel Stays first, because that is where the booking will actually go.
  // Amadeus stays as the fallback; the sample hotel below is the last resort.
  let hotel: TripOffer | null = await duffelStay(input).catch(() => null);
  if (!hotel && token) {
    hotel = await amadeusHotel(input, token);
    if (!hotel) warnings.push("No hotel offers available from the API for these dates.");
  }

  const demo = demoOffers(input);
  offers.push(flight ?? demo.find((o) => o.kind === "flight")!);
  offers.push(hotel ?? demo.find((o) => o.kind === "hotel")!);
  const car = demo.find((o) => o.kind === "car");
  if (car) {
    offers.push(car);
    if (token || flight) {
      warnings.push(
        "Car rental: no public API available from current providers — item priced as an estimate.",
      );
    }
  }

  const liveCount = offers.filter((o) => o.live).length;
  const currency = offers[0]?.currency ?? "EUR";
  // Only worth asking when the flight we are comparing against is a real one.
  const flexSaving =
    flight && flight.live ? await flexibleSaving(input, flight).catch(() => null) : null;
  return {
    offers,
    total: round(offers.reduce((sum, o) => sum + o.amount, 0)),
    currency,
    source: liveCount === offers.length ? "live" : liveCount > 0 ? "partial" : "demo",
    warnings,
    ...(flexSaving ? { flexSaving } : {}),
  };
}
