/**
 * Server-only travel provider access.
 * Flights: Duffel (preferred) or Amadeus. Hotels: Amadeus. Cars: Amadeus
 * transfer/car estimate. When credentials are missing we fall back to clearly
 * flagged sample data so the concept demo keeps working.
 */

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
  /** Optional swap-in options (hotels): shown only on demand. */
  alternatives?: Array<Omit<TripOffer, "alternatives">>;
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
};

export type TripSearchResult = {
  offers: TripOffer[];
  total: number;
  currency: string;
  source: "live" | "partial" | "demo";
  warnings: string[];
};

const round = (n: number) => Math.round(n * 100) / 100;

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

/* ---------------- Duffel: flights ---------------- */

async function duffelFlight(input: TripSearchInput): Promise<TripOffer | null> {
  const token = process.env["DUFFEL_ACCESS_TOKEN"];
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
        slices: [
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
        passengers: [{ type: "adult" }],
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
  const best = offers
    .slice()
    .sort((a, b) => Number(a.total_amount) - Number(b.total_amount))[0]!;

  const seg = best.slices?.[0]?.segments?.[0];
  const carrier = seg?.marketing_carrier?.name ?? best.owner?.name ?? "Przewoźnik";
  const flightNo = `${seg?.marketing_carrier?.iata_code ?? ""}${seg?.marketing_carrier_flight_number ?? ""}`;
  const dep = seg?.departing_at?.slice(11, 16) ?? "";
  const arr = seg?.arriving_at?.slice(11, 16) ?? "";

  return {
    kind: "flight",
    title: `${carrier} ${flightNo} · ${input.originIata} → ${input.destinationIata}`.trim(),
    detail: `Wylot ${fmtDate(input.departDate)} ${dep} – ${arr} · powrót ${fmtDate(input.returnDate)} · ${cabin.replace("_", " ")}`,
    provider: "Duffel",
    offerReference: best.id,
    amount: round(Number(best.total_amount)),
    currency: best.total_currency,
    live: true,
  };
}

/* ---------------- Amadeus ---------------- */

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

async function amadeusFlight(
  input: TripSearchInput,
  token: string,
): Promise<TripOffer | null> {
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
    title: `${seg?.carrierCode ?? ""} ${seg?.number ?? ""} · ${input.originIata} → ${input.destinationIata}`.trim(),
    detail: `Wylot ${fmtDate(input.departDate)} ${seg?.departure?.at?.slice(11, 16) ?? ""} – ${seg?.arrival?.at?.slice(11, 16) ?? ""} · powrót ${fmtDate(input.returnDate)}`,
    provider: "Amadeus",
    offerReference: `AM-FL-${best.id}`,
    amount: round(Number(best.price?.total ?? 0)),
    currency: best.price?.currency ?? "EUR",
    live: true,
  };
}

async function amadeusHotel(
  input: TripSearchInput,
  token: string,
): Promise<TripOffer | null> {
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
      (new Date(input.returnDate).getTime() - new Date(input.departDate).getTime()) /
        86_400_000,
    ),
  );

  return {
    kind: "hotel",
    title: best.hotel?.name ?? "Hotel",
    detail: `${nights} ${nights === 1 ? "noc" : "noce"} · zameldowanie ${fmtDate(input.departDate)} · ${input.destinationCity}`,
    provider: "Amadeus",
    offerReference: best.offer.id ?? `AM-HT-${best.hotel?.hotelId ?? ""}`,
    amount: round(Number(best.offer.price?.total ?? 0)),
    currency: best.offer.price?.currency ?? "EUR",
    live: true,
  };
}

/* ---------------- Sample fallbacks ---------------- */

function demoOffers(input: TripSearchInput): TripOffer[] {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(input.returnDate).getTime() - new Date(input.departDate).getTime()) /
        86_400_000,
    ),
  );
  const offers: TripOffer[] = [
    {
      kind: "flight",
      title: `Lot ${input.originIata} → ${input.destinationIata}`,
      detail: `Wylot ${fmtDate(input.departDate)} · powrót ${fmtDate(input.returnDate)} · dane przykładowe`,
      provider: "przykład",
      offerReference: "PRZYKŁAD-LOT",
      amount: 412,
      currency: "EUR",
      live: false,
    },
    {
      kind: "hotel",
      title: `Hotel w centrum · ${input.destinationCity}`,
      detail: `${nights} ${nights === 1 ? "noc" : "noce"} · dane przykładowe`,
      provider: "przykład",
      offerReference: "PRZYKŁAD-HOTEL",
      amount: 305 * nights,
      currency: "EUR",
      live: false,
    },
  ];
  if (input.needsCar !== false) {
    offers.push({
      kind: "car",
      title: `Samochód · odbiór ${input.destinationIata}`,
      detail: `${fmtDate(input.departDate)} – ${fmtDate(input.returnDate)} · automat, pełne ubezpieczenie · dane przykładowe`,
      provider: "przykład",
      offerReference: "PRZYKŁAD-AUTO",
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
    flight = await duffelFlight(input);
  } catch {
    warnings.push("Duffel nie zwrócił ofert lotów — pokazuję wartość przykładową.");
  }

  const token = await amadeusToken();
  if (!token && !flight) {
    warnings.push(
      "Brak kluczy API dostawców — karta zawiera dane przykładowe. Dodaj klucze Duffel i Amadeus, aby zobaczyć rzeczywiste ceny.",
    );
  }

  if (!flight && token) {
    flight = await amadeusFlight(input, token);
    if (!flight) warnings.push("Brak dostępnych lotów w API na te daty.");
  }

  let hotel: TripOffer | null = null;
  if (token) {
    hotel = await amadeusHotel(input, token);
    if (!hotel) warnings.push("Brak dostępnych ofert hotelowych w API na te daty.");
  }

  const demo = demoOffers(input);
  offers.push(flight ?? demo.find((o) => o.kind === "flight")!);
  offers.push(hotel ?? demo.find((o) => o.kind === "hotel")!);
  const car = demo.find((o) => o.kind === "car");
  if (car) {
    offers.push(car);
    if (token || flight) {
      warnings.push(
        "Wynajem samochodu: brak publicznego API u obecnych dostawców — pozycja wyceniona szacunkowo.",
      );
    }
  }

  const liveCount = offers.filter((o) => o.live).length;
  const currency = offers[0]?.currency ?? "EUR";
  return {
    offers,
    total: round(offers.reduce((sum, o) => sum + o.amount, 0)),
    currency,
    source: liveCount === offers.length ? "live" : liveCount > 0 ? "partial" : "demo",
    warnings,
  };
}
