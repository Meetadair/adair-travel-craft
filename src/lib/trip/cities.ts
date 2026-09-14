/**
 * City → IATA + centre coordinates map used by the trip parser and the
 * Duffel Stays / Cars searches. Covers the 40 largest European cities plus
 * Tokyo, New York and Dubai. `iata` is the main airport code we search on.
 */
export type CityEntry = {
  city: string;
  iata: string;
  lat: number;
  lon: number;
  /** Lower-case match terms, including common local spellings. */
  aliases: string[];
};

export const CITIES: CityEntry[] = [
  {
    city: "London",
    iata: "LHR",
    lat: 51.5072,
    lon: -0.1276,
    aliases: ["london", "londyn", "londres", "londra"],
  },
  {
    city: "Paris",
    iata: "CDG",
    lat: 48.8566,
    lon: 2.3522,
    aliases: ["paris", "paryz", "paryż", "parigi"],
  },
  { city: "Madrid", iata: "MAD", lat: 40.4168, lon: -3.7038, aliases: ["madrid", "madryt"] },
  {
    city: "Barcelona",
    iata: "BCN",
    lat: 41.3874,
    lon: 2.1686,
    aliases: ["barcelona", "barcelone", "barcellona"],
  },
  {
    city: "Rome",
    iata: "FCO",
    lat: 41.9028,
    lon: 12.4964,
    aliases: ["rome", "roma", "rzym", "rom"],
  },
  {
    city: "Milan",
    iata: "LIN",
    lat: 45.4642,
    lon: 9.19,
    aliases: ["milan", "milano", "mediolan", "mailand"],
  },
  {
    city: "Naples",
    iata: "NAP",
    lat: 40.8518,
    lon: 14.2681,
    aliases: ["naples", "napoli", "neapol"],
  },
  { city: "Berlin", iata: "BER", lat: 52.52, lon: 13.405, aliases: ["berlin", "berlino"] },
  { city: "Hamburg", iata: "HAM", lat: 53.5511, lon: 9.9937, aliases: ["hamburg", "hambourg"] },
  {
    city: "Munich",
    iata: "MUC",
    lat: 48.1351,
    lon: 11.582,
    aliases: ["munich", "munchen", "münchen", "monachium"],
  },
  {
    city: "Frankfurt",
    iata: "FRA",
    lat: 50.1109,
    lon: 8.6821,
    aliases: ["frankfurt", "frankfurcie"],
  },
  {
    city: "Cologne",
    iata: "CGN",
    lat: 50.9375,
    lon: 6.9603,
    aliases: ["cologne", "koln", "köln", "kolonia"],
  },
  {
    city: "Vienna",
    iata: "VIE",
    lat: 48.2082,
    lon: 16.3738,
    aliases: ["vienna", "wien", "wieden", "wiedeń", "viena"],
  },
  {
    city: "Zurich",
    iata: "ZRH",
    lat: 47.3769,
    lon: 8.5417,
    aliases: ["zurich", "zurych", "zürich"],
  },
  {
    city: "Geneva",
    iata: "GVA",
    lat: 46.2044,
    lon: 6.1432,
    aliases: ["geneva", "geneve", "genève", "genewa"],
  },
  {
    city: "Amsterdam",
    iata: "AMS",
    lat: 52.3676,
    lon: 4.9041,
    aliases: ["amsterdam", "amsterdamie"],
  },
  {
    city: "Brussels",
    iata: "BRU",
    lat: 50.8503,
    lon: 4.3517,
    aliases: ["brussels", "bruxelles", "bruksela", "brussel"],
  },
  {
    city: "Copenhagen",
    iata: "CPH",
    lat: 55.6761,
    lon: 12.5683,
    aliases: ["copenhagen", "kobenhavn", "københavn", "kopenhaga"],
  },
  {
    city: "Stockholm",
    iata: "ARN",
    lat: 59.3293,
    lon: 18.0686,
    aliases: ["stockholm", "sztokholm"],
  },
  { city: "Oslo", iata: "OSL", lat: 59.9139, lon: 10.7522, aliases: ["oslo"] },
  {
    city: "Helsinki",
    iata: "HEL",
    lat: 60.1699,
    lon: 24.9384,
    aliases: ["helsinki", "helsinkach"],
  },
  { city: "Dublin", iata: "DUB", lat: 53.3498, lon: -6.2603, aliases: ["dublin", "dublinie"] },
  {
    city: "Lisbon",
    iata: "LIS",
    lat: 38.7223,
    lon: -9.1393,
    aliases: ["lisbon", "lisboa", "lizbona", "lissabon"],
  },
  { city: "Porto", iata: "OPO", lat: 41.1579, lon: -8.6291, aliases: ["porto"] },
  {
    city: "Warsaw",
    iata: "WAW",
    lat: 52.2297,
    lon: 21.0122,
    aliases: ["warsaw", "warszawa", "warschau", "varsovie"],
  },
  {
    city: "Krakow",
    iata: "KRK",
    lat: 50.0647,
    lon: 19.945,
    aliases: ["krakow", "kraków", "cracow", "krakau"],
  },
  {
    city: "Prague",
    iata: "PRG",
    lat: 50.0755,
    lon: 14.4378,
    aliases: ["prague", "praha", "praga", "prag"],
  },
  { city: "Budapest", iata: "BUD", lat: 47.4979, lon: 19.0402, aliases: ["budapest", "budapeszt"] },
  {
    city: "Bucharest",
    iata: "OTP",
    lat: 44.4268,
    lon: 26.1025,
    aliases: ["bucharest", "bucuresti", "bukareszt"],
  },
  { city: "Sofia", iata: "SOF", lat: 42.6977, lon: 23.3219, aliases: ["sofia", "sofii"] },
  {
    city: "Belgrade",
    iata: "BEG",
    lat: 44.7866,
    lon: 20.4489,
    aliases: ["belgrade", "beograd", "belgrad"],
  },
  { city: "Zagreb", iata: "ZAG", lat: 45.815, lon: 15.9819, aliases: ["zagreb", "zagrzeb"] },
  {
    city: "Athens",
    iata: "ATH",
    lat: 37.9838,
    lon: 23.7275,
    aliases: ["athens", "athina", "ateny", "athenes"],
  },
  {
    city: "Istanbul",
    iata: "IST",
    lat: 41.0082,
    lon: 28.9784,
    aliases: ["istanbul", "stambul", "stambuł"],
  },
  { city: "Riga", iata: "RIX", lat: 56.9496, lon: 24.1052, aliases: ["riga", "ryga"] },
  { city: "Vilnius", iata: "VNO", lat: 54.6872, lon: 25.2797, aliases: ["vilnius", "wilno"] },
  { city: "Tallinn", iata: "TLL", lat: 59.437, lon: 24.7536, aliases: ["tallinn", "tallin"] },
  { city: "Valencia", iata: "VLC", lat: 39.4699, lon: -0.3763, aliases: ["valencia", "walencja"] },
  {
    city: "Seville",
    iata: "SVQ",
    lat: 37.3891,
    lon: -5.9845,
    aliases: ["seville", "sevilla", "sewilla"],
  },
  { city: "Manchester", iata: "MAN", lat: 53.4808, lon: -2.2426, aliases: ["manchester"] },
  {
    city: "Edinburgh",
    iata: "EDI",
    lat: 55.9533,
    lon: -3.1883,
    aliases: ["edinburgh", "edynburg"],
  },
  { city: "Tokyo", iata: "HND", lat: 35.6762, lon: 139.6503, aliases: ["tokyo", "tokio", "東京"] },
  {
    city: "New York",
    iata: "JFK",
    lat: 40.7128,
    lon: -74.006,
    aliases: ["new york", "nowy jork", "nyc", "manhattan"],
  },
  { city: "Dubai", iata: "DXB", lat: 25.2048, lon: 55.2708, aliases: ["dubai", "dubaj"] },
  {
    city: "San Francisco",
    iata: "SFO",
    lat: 37.7749,
    lon: -122.4194,
    aliases: ["san francisco", "sf bay area"],
  },
  { city: "Los Angeles", iata: "LAX", lat: 34.0522, lon: -118.2437, aliases: ["los angeles"] },
  { city: "Chicago", iata: "ORD", lat: 41.8781, lon: -87.6298, aliases: ["chicago"] },
  { city: "Boston", iata: "BOS", lat: 42.3601, lon: -71.0589, aliases: ["boston"] },
  { city: "Miami", iata: "MIA", lat: 25.7617, lon: -80.1918, aliases: ["miami"] },
  { city: "Toronto", iata: "YYZ", lat: 43.6532, lon: -79.3832, aliases: ["toronto"] },
  {
    city: "Singapore",
    iata: "SIN",
    lat: 1.3521,
    lon: 103.8198,
    aliases: ["singapore", "singapur"],
  },
  {
    city: "Hong Kong",
    iata: "HKG",
    lat: 22.3193,
    lon: 114.1694,
    aliases: ["hong kong", "hongkong"],
  },
];

export const DEFAULT_ORIGIN = CITIES.find((c) => c.iata === "WAW")!;

/**
 * An alias has to start a word, and may carry a short inflectional ending.
 *
 * A plain `indexOf` once sent "fly to San Francisco from Warsaw" to Rome,
 * because the German alias "rom" sits inside "from" and nothing questioned it.
 * Requiring a letter boundary BEFORE the alias kills that whole class of bug.
 *
 * Requiring one after it would be wrong here: Polish inflects the destination
 * ("do Rzymu", "w Rzymie"), and those have to keep working. So up to three
 * trailing letters are allowed, which still rejects "romantic" - "antic" is
 * four letters and more. \\b is no help either way: it only knows ASCII and
 * would misfire next to a Polish diacritic.
 */
const WORDISH = "[\\p{L}\\p{N}]";
const aliasPatterns = new Map<string, RegExp>();

function aliasPattern(alias: string): RegExp {
  let re = aliasPatterns.get(alias);
  if (!re) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<!${WORDISH})${escaped}(?!${WORDISH}{4})`, "u");
    aliasPatterns.set(alias, re);
  }
  return re;
}

export function findCity(text: string, exclude?: string): CityEntry | null {
  let best: { city: CityEntry; at: number } | null = null;
  for (const city of CITIES) {
    if (city.iata === exclude) continue;
    for (const alias of city.aliases) {
      const found = aliasPattern(alias).exec(text);
      if (!found) continue;
      const at = found.index;
      if (!best || at < best.at) best = { city, at };
    }
  }
  return best?.city ?? null;
}
