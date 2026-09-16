/**
 * Home-airport picker data: the largest European airports plus the major
 * global hubs. Shown as "City (IATA)" in the searchable onboarding field.
 */
export type AirportEntry = { city: string; iata: string; country: string; name: string };

export const AIRPORTS: AirportEntry[] = [
  { city: "Warsaw", iata: "WAW", country: "Poland", name: "Chopin" },
  { city: "Krakow", iata: "KRK", country: "Poland", name: "Balice" },
  { city: "Gdansk", iata: "GDN", country: "Poland", name: "Lech Wałęsa" },
  { city: "Wroclaw", iata: "WRO", country: "Poland", name: "Copernicus" },
  { city: "Katowice", iata: "KTW", country: "Poland", name: "Pyrzowice" },
  { city: "London", iata: "LHR", country: "United Kingdom", name: "Heathrow" },
  { city: "London", iata: "LGW", country: "United Kingdom", name: "Gatwick" },
  { city: "London", iata: "STN", country: "United Kingdom", name: "Stansted" },
  { city: "Manchester", iata: "MAN", country: "United Kingdom", name: "Manchester" },
  { city: "Edinburgh", iata: "EDI", country: "United Kingdom", name: "Edinburgh" },
  { city: "Dublin", iata: "DUB", country: "Ireland", name: "Dublin" },
  { city: "Paris", iata: "CDG", country: "France", name: "Charles de Gaulle" },
  { city: "Paris", iata: "ORY", country: "France", name: "Orly" },
  { city: "Nice", iata: "NCE", country: "France", name: "Côte d'Azur" },
  { city: "Lyon", iata: "LYS", country: "France", name: "Saint-Exupéry" },
  { city: "Amsterdam", iata: "AMS", country: "Netherlands", name: "Schiphol" },
  { city: "Brussels", iata: "BRU", country: "Belgium", name: "Zaventem" },
  { city: "Frankfurt", iata: "FRA", country: "Germany", name: "Frankfurt" },
  { city: "Munich", iata: "MUC", country: "Germany", name: "Munich" },
  { city: "Berlin", iata: "BER", country: "Germany", name: "Brandenburg" },
  { city: "Düsseldorf", iata: "DUS", country: "Germany", name: "Düsseldorf" },
  { city: "Hamburg", iata: "HAM", country: "Germany", name: "Hamburg" },
  { city: "Cologne", iata: "CGN", country: "Germany", name: "Cologne/Bonn" },
  { city: "Stuttgart", iata: "STR", country: "Germany", name: "Stuttgart" },
  { city: "Vienna", iata: "VIE", country: "Austria", name: "Schwechat" },
  { city: "Zurich", iata: "ZRH", country: "Switzerland", name: "Zurich" },
  { city: "Geneva", iata: "GVA", country: "Switzerland", name: "Geneva" },
  { city: "Madrid", iata: "MAD", country: "Spain", name: "Barajas" },
  { city: "Barcelona", iata: "BCN", country: "Spain", name: "El Prat" },
  { city: "Palma de Mallorca", iata: "PMI", country: "Spain", name: "Son Sant Joan" },
  { city: "Malaga", iata: "AGP", country: "Spain", name: "Costa del Sol" },
  { city: "Valencia", iata: "VLC", country: "Spain", name: "Valencia" },
  { city: "Seville", iata: "SVQ", country: "Spain", name: "Seville" },
  { city: "Lisbon", iata: "LIS", country: "Portugal", name: "Humberto Delgado" },
  { city: "Porto", iata: "OPO", country: "Portugal", name: "Francisco Sá Carneiro" },
  { city: "Rome", iata: "FCO", country: "Italy", name: "Fiumicino" },
  { city: "Milan", iata: "MXP", country: "Italy", name: "Malpensa" },
  { city: "Milan", iata: "LIN", country: "Italy", name: "Linate" },
  { city: "Venice", iata: "VCE", country: "Italy", name: "Marco Polo" },
  { city: "Naples", iata: "NAP", country: "Italy", name: "Capodichino" },
  { city: "Copenhagen", iata: "CPH", country: "Denmark", name: "Kastrup" },
  { city: "Stockholm", iata: "ARN", country: "Sweden", name: "Arlanda" },
  { city: "Oslo", iata: "OSL", country: "Norway", name: "Gardermoen" },
  { city: "Helsinki", iata: "HEL", country: "Finland", name: "Vantaa" },
  { city: "Prague", iata: "PRG", country: "Czechia", name: "Václav Havel" },
  { city: "Budapest", iata: "BUD", country: "Hungary", name: "Ferenc Liszt" },
  { city: "Bucharest", iata: "OTP", country: "Romania", name: "Otopeni" },
  { city: "Sofia", iata: "SOF", country: "Bulgaria", name: "Sofia" },
  { city: "Belgrade", iata: "BEG", country: "Serbia", name: "Nikola Tesla" },
  { city: "Zagreb", iata: "ZAG", country: "Croatia", name: "Franjo Tuđman" },
  { city: "Athens", iata: "ATH", country: "Greece", name: "Eleftherios Venizelos" },
  { city: "Istanbul", iata: "IST", country: "Türkiye", name: "Istanbul" },
  { city: "Riga", iata: "RIX", country: "Latvia", name: "Riga" },
  { city: "Vilnius", iata: "VNO", country: "Lithuania", name: "Vilnius" },
  { city: "Tallinn", iata: "TLL", country: "Estonia", name: "Lennart Meri" },
  { city: "New York", iata: "JFK", country: "United States", name: "John F. Kennedy" },
  { city: "Newark", iata: "EWR", country: "United States", name: "Newark" },
  { city: "Chicago", iata: "ORD", country: "United States", name: "O'Hare" },
  { city: "Los Angeles", iata: "LAX", country: "United States", name: "Los Angeles" },
  { city: "Miami", iata: "MIA", country: "United States", name: "Miami" },
  { city: "Toronto", iata: "YYZ", country: "Canada", name: "Pearson" },
  { city: "Dubai", iata: "DXB", country: "United Arab Emirates", name: "Dubai" },
  { city: "Doha", iata: "DOH", country: "Qatar", name: "Hamad" },
  { city: "Tokyo", iata: "HND", country: "Japan", name: "Haneda" },
  { city: "Singapore", iata: "SIN", country: "Singapore", name: "Changi" },
  { city: "Hong Kong", iata: "HKG", country: "Hong Kong", name: "Hong Kong" },
  { city: "Sydney", iata: "SYD", country: "Australia", name: "Kingsford Smith" },
  { city: "São Paulo", iata: "GRU", country: "Brazil", name: "Guarulhos" },
  { city: "Johannesburg", iata: "JNB", country: "South Africa", name: "O. R. Tambo" },
  { city: "Tel Aviv", iata: "TLV", country: "Israel", name: "Ben Gurion" },
];

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function airportLabel(entry: AirportEntry): string {
  return `${entry.city} (${entry.iata})`;
}

export function findAirports(query: string, limit = 8): AirportEntry[] {
  const q = fold(query.trim());
  if (!q) return AIRPORTS.slice(0, limit);
  return AIRPORTS.filter((a) =>
    [a.city, a.iata, a.country, a.name].some((field) => fold(field).includes(q)),
  ).slice(0, limit);
}

export function airportByIata(iata: string): AirportEntry | null {
  const code = iata.trim().toUpperCase();
  return AIRPORTS.find((a) => a.iata === code) ?? null;
}

/**
 * Where the traveller most likely departs from, before they have told us
 * anything.
 *
 * The browser's time zone is a real signal, not a guess: someone in
 * Europe/Warsaw departs from a Polish airport far more often than from a
 * Spanish one, and offering the five airports of their own country is the
 * difference between a chip they tap and an empty search box they have to
 * think about. Anything unrecognised returns nothing rather than a default —
 * an empty box beats a box full of the wrong country.
 */
const ZONE_COUNTRY: Record<string, string> = {
  "Europe/Warsaw": "Poland",
  "Europe/Berlin": "Germany",
  "Europe/Vienna": "Austria",
  "Europe/Zurich": "Switzerland",
  "Europe/Paris": "France",
  "Europe/Brussels": "Belgium",
  "Europe/Amsterdam": "Netherlands",
  "Europe/London": "United Kingdom",
  "Europe/Dublin": "Ireland",
  "Europe/Madrid": "Spain",
  "Europe/Lisbon": "Portugal",
  "Europe/Rome": "Italy",
  "Europe/Prague": "Czechia",
  "Europe/Budapest": "Hungary",
  "Europe/Bratislava": "Slovakia",
  "Europe/Ljubljana": "Slovenia",
  "Europe/Zagreb": "Croatia",
  "Europe/Bucharest": "Romania",
  "Europe/Sofia": "Bulgaria",
  "Europe/Athens": "Greece",
  "Europe/Stockholm": "Sweden",
  "Europe/Oslo": "Norway",
  "Europe/Copenhagen": "Denmark",
  "Europe/Helsinki": "Finland",
  "Europe/Vilnius": "Lithuania",
  "Europe/Riga": "Latvia",
  "Europe/Tallinn": "Estonia",
  "Europe/Istanbul": "Turkey",
};

export function countryForTimeZone(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  return ZONE_COUNTRY[timeZone] ?? null;
}

/** The airports we know in one country, biggest first — the list is ordered. */
export function airportsInCountry(country: string | null, limit = 5): AirportEntry[] {
  if (!country) return [];
  return AIRPORTS.filter((airport) => airport.country === country).slice(0, limit);
}

/**
 * The chips to show under "where are you flying from": airports this traveller
 * has chosen before, then their own country's, never the destination, never
 * the same airport twice.
 */
export function likelyOrigins(
  { used = [], country = null, exclude = [] }: {
    used?: string[];
    country?: string | null;
    exclude?: string[];
  },
  limit = 5,
): AirportEntry[] {
  const barred = new Set(exclude.map((code) => code.toUpperCase()));
  const out: AirportEntry[] = [];
  const seen = new Set<string>();
  const add = (entry: AirportEntry | null) => {
    if (!entry || barred.has(entry.iata) || seen.has(entry.iata) || out.length >= limit) return;
    seen.add(entry.iata);
    out.push(entry);
  };
  for (const code of used) add(airportByIata(code));
  for (const entry of airportsInCountry(country, limit)) add(entry);
  return out;
}
