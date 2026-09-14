/**
 * The routes we publish.
 *
 * A route is a reason to go, not a destination: the same country read three
 * ways gives three different journeys. Each one is real geography — real
 * towns, real distances, roads that exist — written so a traveller can picture
 * the week before they commit to it.
 *
 * What is deliberately absent: hotels. Where they sleep comes from a live
 * search when they plan the route, because a listing that names a property can
 * promise one that is full, closed or no longer in our supply. The route says
 * where to be and why; the search says where to stay.
 *
 * Drive times are typical door-to-door by car, rounded, and stated as
 * approximate wherever they are shown.
 */

import type { GetawayImage } from "@/lib/getaway/images";

export type RouteDay = {
  dayNumber: number;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
  /** Set on the day they move on; null when they stay put. */
  travelNote: string | null;
  driveMinutes: number | null;
  /** Road distance for that leg, not straight line. */
  driveKm: number | null;
  /** Worth a stop on the way rather than at the destination. */
  onTheRoad: string | null;
  /**
   * Set once a picture has been chosen for this stop. Null until then — an
   * empty frame reads better than someone else's photograph.
   */
  image: GetawayImage | null;
};

export type SeedRoute = {
  slug: string;
  title: string;
  summary: string;
  /** The one picture at the top. Null until a licensed image is attached. */
  hero: GetawayImage | null;
  countries: string[];
  themes: string[];
  nights: number;
  season: string;
  featured: boolean;
  days: RouteDay[];
};

const stay = (
  dayNumber: number,
  city: string,
  country: string,
  latitude: number,
  longitude: number,
  parts: { morning?: string; afternoon?: string; evening?: string },
): RouteDay => ({
  dayNumber,
  city,
  country,
  latitude,
  longitude,
  morning: parts.morning ?? null,
  afternoon: parts.afternoon ?? null,
  evening: parts.evening ?? null,
  travelNote: null,
  driveMinutes: null,
  driveKm: null,
  onTheRoad: null,
  image: null,
});

const move = (
  day: RouteDay,
  travelNote: string,
  driveMinutes: number,
  driveKm: number,
  onTheRoad?: string,
): RouteDay => ({
  ...day,
  travelNote,
  driveMinutes,
  driveKm,
  onTheRoad: onTheRoad ?? null,
});

export const SEED_ROUTES: SeedRoute[] = [
  {
    slug: "dolomites-passes",
    title: "Over the Dolomite passes",
    hero: null,
    summary:
      "Four passes, three valleys and the best driving road in Europe — taken slowly, with lunch at the top.",
    countries: ["Italy"],
    themes: ["on-the-mountain", "driving", "wine-and-gastronomy"],
    nights: 5,
    season: "June to early October, once the passes clear",
    featured: true,
    days: [
      stay(1, "Bolzano", "Italy", 46.498, 11.3548, {
        morning: "Arrive and leave the car. Bolzano is a walking town for an afternoon.",
        afternoon: "The archaeology museum, for the man who came out of the ice at 3,200 metres.",
        evening:
          "Speck, dumplings and a Lagrein. The food here is Austrian with an Italian accent.",
      }),
      move(
        stay(2, "Alpe di Siusi", "Italy", 46.5405, 11.6244, {
          morning:
            "Up early and up high: the largest alpine meadow in Europe, above the tree line.",
          afternoon:
            "Walk the Sassolungo loop. Flat, long, and the whole massif in view the whole way.",
          evening: "Sunset turns the rock pink for about twenty minutes. Be outside for it.",
        }),
        "The road up is closed to cars in the day — cable car from Ortisei.",
        50,
        25,
      ),
      move(
        stay(3, "Cortina d'Ampezzo", "Italy", 46.5405, 12.1357, {
          morning:
            "Passo Gardena, then Passo Falzarego. Stop at both. This is the drive people come for.",
          afternoon:
            "The Cinque Torri, and the open-air museum of the front line that ran through here.",
          evening: "Cortina in the evening is a promenade. Join it.",
        }),
        "Two passes, hairpins throughout. Two hours of map time, four of real time.",
        150,
        95,
      ),
      move(
        stay(4, "Lago di Braies", "Italy", 46.6947, 12.0854, {
          morning:
            "Be at the lake before eight or after five. In between it belongs to the coaches.",
          afternoon: "Val di Braies on foot, away from the water.",
          evening: "An early night. Tomorrow is the long descent.",
        }),
        "North through Cortina and down the Val Pusteria.",
        70,
        60,
      ),
      move(
        stay(5, "Merano", "Italy", 46.6713, 11.1594, {
          morning: "West along the valley floor, orchards the whole way.",
          afternoon: "The Trauttmansdorff gardens, terraced up the hillside above the town.",
          evening: "Thermal baths, then dinner. The valley grows white wine worth a detour.",
        }),
        "Back over the Passo Giovo, or the fast way through Bolzano if the light has gone.",
        120,
        110,
      ),
    ],
  },

  {
    slug: "baltic-coast-poland",
    title: "The Polish Baltic, out of season",
    hero: null,
    summary:
      "Dunes, a drowned forest and three towns that look nothing alike. Best when the crowds have gone home.",
    countries: ["Poland"],
    themes: ["by-the-water", "hidden-gems", "family-escapes"],
    nights: 5,
    season: "May, June and September — July and August belong to everyone else",
    featured: true,
    days: [
      stay(1, "Gdańsk", "Poland", 54.352, 18.6466, {
        morning: "The long waterfront, and a city rebuilt brick by brick from photographs.",
        afternoon: "The Second World War museum. Allow three hours; most people wish they had.",
        evening: "Dinner on Mariacka, under the gargoyles that drain the rain into the street.",
      }),
      stay(2, "Sopot", "Poland", 54.4418, 18.5601, {
        morning: "The longest wooden pier in Europe, walked to the end and back.",
        afternoon: "The beach runs unbroken for kilometres. Pick a direction.",
        evening: "The spa town does evenings well. It has been doing them since the 1820s.",
      }),
      move(
        stay(3, "Łeba", "Poland", 54.7606, 17.5546, {
          morning: "West along the coast road, pine forest on both sides.",
          afternoon:
            "The shifting dunes of the Słowiński park — sand mountains that move metres a year.",
          evening: "A fishing town that empties in September. That is the point.",
        }),
        "Coast road west. Slow, single carriageway, worth it.",
        110,
        95,
      ),
      stay(4, "Słowiński National Park", "Poland", 54.7333, 17.45, {
        morning: "Back into the dunes at first light, when the sand still holds the night's shape.",
        afternoon: "Lake Łebsko from the eastern shore, where the birds are.",
        evening: "Smoked fish, eaten standing up, from the harbour.",
      }),
      move(
        stay(5, "Malbork", "Poland", 54.0396, 19.0277, {
          morning: "Inland and south, out of the sand.",
          afternoon: "The largest castle in the world by land area. It takes the afternoon.",
          evening: "Back to Gdańsk for the flight, or stay and see the castle lit.",
        }),
        "South-east through Lębork. Motorway for the last stretch.",
        140,
        150,
      ),
    ],
  },

  {
    slug: "hungarian-wine-and-water",
    title: "Hungarian wine and water",
    hero: null,
    summary:
      "Budapest, the Danube bend and a volcanic lakeshore where the white wine tastes of the rock it grew on.",
    countries: ["Hungary"],
    themes: ["wine-and-gastronomy", "by-the-water", "city-break"],
    nights: 6,
    season: "Late April to October; the harvest turns the lakeshore in September",
    featured: false,
    days: [
      stay(1, "Budapest", "Hungary", 47.4979, 19.0402, {
        morning: "Arrive, drop the bags, walk the Danube from the Chain Bridge to Parliament.",
        afternoon: "The market hall, then across to Buda on foot.",
        evening: "A bath at the end of the day, then dinner late. The city eats late.",
      }),
      stay(2, "Budapest", "Hungary", 47.4979, 19.0402, {
        morning: "The seventh district on foot, courtyards and all.",
        afternoon: "The Museum of Fine Arts, or the House of Music if the weather holds.",
        evening: "Wine bar rather than restaurant. Hungarian whites are the reason you came.",
      }),
      move(
        stay(3, "Szentendre", "Hungary", 47.6694, 19.0756, {
          morning: "North out of the city along the river.",
          afternoon: "A town of painters, churches and steep cobbled lanes above the water.",
          evening: "Quiet. That is the appeal after two nights in the capital.",
        }),
        "Half an hour up the Danube, or the suburban train if you would rather not drive.",
        35,
        25,
      ),
      move(
        stay(4, "Tihany", "Hungary", 46.9139, 17.8875, {
          morning: "South-west, out of the Danube valley and onto the Balaton plain.",
          afternoon: "The peninsula, the abbey, and the inner lake that sits above the big one.",
          evening: "Lavender everywhere in June. Sunset over water from the high side.",
        }),
        "Two hours south-west on the M7.",
        130,
        135,
      ),
      stay(5, "Badacsony", "Hungary", 46.7908, 17.5039, {
        morning: "Up the basalt hill on foot. The vineyards climb it in terraces.",
        afternoon: "Cellar visits. The volcanic soil is the whole story of the wine here.",
        evening: "Fish from the lake, white wine from the hill behind you.",
      }),
      move(
        stay(6, "Hévíz", "Hungary", 46.7886, 17.1897, {
          morning: "West along the shore.",
          afternoon: "The thermal lake — warm enough to swim in outdoors in November.",
          evening: "Back towards Budapest, or a last night on the water.",
        }),
        "Forty minutes west, end of the lake.",
        45,
        40,
      ),
    ],
  },

  {
    slug: "new-york-to-maine",
    title: "New York to the Maine woods",
    hero: null,
    summary:
      "Out of the loudest city in America and north until the traffic stops, the trees start and a moose crosses the road.",
    countries: ["United States"],
    themes: ["city-break", "driving", "hidden-gems"],
    nights: 5,
    season:
      "Late May to October. The first two weeks of October are the ones people plan years ahead for.",
    featured: true,
    days: [
      stay(1, "New York", "United States", 40.7128, -74.006, {
        morning:
          "Land, drop the bags, get on the subway. Nobody drives here and neither should you.",
        afternoon: "The High Line north to Hudson Yards, then down into Chelsea for the galleries.",
        evening: "Eat in a neighbourhood, not in Midtown. The West Village or the Lower East Side.",
      }),
      stay(2, "New York", "United States", 40.7128, -74.006, {
        morning:
          "One museum, properly, instead of three in a hurry. The Met takes a morning on its own.",
        afternoon: "Brooklyn Bridge on foot, east to west, then Dumbo underneath it.",
        evening:
          "Pick up the car tonight if you can. Leaving the city at eight tomorrow beats leaving at ten.",
      }),
      move(
        stay(3, "Lexington", "United States", 42.4473, -71.2245, {
          morning: "North on I-95. Connecticut for two hours, then the road thins out.",
          afternoon:
            "Where the Revolutionary War started, on a green the size of a village cricket pitch.",
          evening:
            "Boston is twenty minutes away if you want a city dinner. It is also fine not to.",
        }),
        "Roughly four hours with one stop. Leave before the Bronx wakes up.",
        240,
        330,
        "New Haven, halfway, for pizza that people argue about seriously.",
      ),
      move(
        stay(4, "Greenville", "United States", 45.4592, -69.5953, {
          morning: "North again, and this time it keeps getting emptier.",
          afternoon: "Moosehead Lake. Forty kilometres of it, and one small town on the shore.",
          evening: "One of the darkest skies on the east coast. Go outside after dinner.",
        }),
        "Long. Five hours through New Hampshire and into the Maine interior.",
        300,
        420,
        "Portsmouth, on the New Hampshire coast, for lunch and a walk round the old harbour.",
      ),
      stay(5, "Greenville", "United States", 45.4592, -69.5953, {
        morning: "On the water early — canoe, or the old steamboat if it is running.",
        afternoon: "Mount Kineo rises straight out of the lake. Climb it, or look at it.",
        evening: "Nothing planned. That is what the last day of this one is for.",
      }),
    ],
  },

  {
    slug: "morocco-imperial-cities",
    title: "The four imperial cities",
    hero: null,
    summary:
      "Marrakesh, Fez, Meknes and Rabat — a thousand years of capitals, each one convinced it was the real one.",
    countries: ["Morocco"],
    themes: ["city-break", "hidden-gems", "wine-and-gastronomy"],
    nights: 7,
    season: "March to May, and October to November. Marrakesh in August is punishing.",
    featured: false,
    days: [
      stay(1, "Marrakesh", "Morocco", 31.6295, -7.9811, {
        morning: "Arrive and do nothing. The medina is easier once you have slept.",
        afternoon: "The Bahia Palace, then get lost on purpose in the souks north of it.",
        evening: "Jemaa el-Fnaa fills up after dark. Eat at a stall, standing.",
      }),
      stay(2, "Marrakesh", "Morocco", 31.6295, -7.9811, {
        morning: "The Majorelle garden early, before the queue forms.",
        afternoon: "The tanneries and the Saadian tombs, or a hammam if the heat has won.",
        evening: "A rooftop at sunset. The call to prayer comes from every direction at once.",
      }),
      move(
        stay(3, "Fez", "Morocco", 34.0181, -5.0078, {
          morning: "North over the Middle Atlas. The landscape changes every hour.",
          afternoon:
            "Arrive, walk to the edge of the medina and no further. Tomorrow is for inside.",
          evening: "Fez is quieter than Marrakesh at night. That is not a criticism.",
        }),
        "Six hours by road, or take the train and skip the driving entirely.",
        360,
        530,
        "Ifrane, an alpine-looking town in the middle of Morocco that makes no sense and is worth ten minutes.",
      ),
      stay(4, "Fez", "Morocco", 34.0181, -5.0078, {
        morning:
          "Fes el-Bali with a guide. Nine thousand lanes and no cars. A guide is not optional.",
        afternoon:
          "The tanneries from a terrace above, the university that predates Oxford by centuries.",
        evening: "Dinner in a riad courtyard. The city turns inward and so should you.",
      }),
      move(
        stay(5, "Meknes", "Morocco", 33.8935, -5.5473, {
          morning: "An hour west, and the crowds drop by ninety per cent.",
          afternoon: "The imperial gates and granaries built for twelve thousand horses.",
          evening: "A working town with a medina nobody is trying to sell you anything in.",
        }),
        "Under an hour. The easiest leg of the week.",
        55,
        60,
        "Volubilis, the Roman city on the plain, half an hour off the road and worth the detour.",
      ),
      move(
        stay(6, "Rabat", "Morocco", 34.0209, -6.8416, {
          morning: "West to the Atlantic, and the temperature drops as you go.",
          afternoon: "The Kasbah of the Udayas, blue and white, above the river mouth.",
          evening: "The capital eats late and well, and almost nobody visits it.",
        }),
        "Two and a half hours west on the motorway.",
        150,
        140,
      ),
      stay(7, "Rabat", "Morocco", 34.0209, -6.8416, {
        morning:
          "The Chellah — Roman ruins, a Muslim necropolis and a colony of storks, in one place.",
        afternoon: "The modern art museum, then the beach if the Atlantic is behaving.",
        evening: "Fly out from here rather than backtracking to Marrakesh.",
      }),
    ],
  },

  {
    slug: "alentejo-slow",
    title: "Alentejo, slowly",
    hero: null,
    summary:
      "Cork oaks, walled towns and a coastline with nothing on it. The part of Portugal people drive past.",
    countries: ["Portugal"],
    themes: ["hidden-gems", "wine-and-gastronomy", "by-the-water"],
    nights: 6,
    season: "March to June, and September to November. July and August are very hot.",
    featured: false,
    days: [
      stay(1, "Évora", "Portugal", 38.5714, -7.9135, {
        morning: "Arrive from Lisbon. The walled town is small enough to learn in a morning.",
        afternoon: "The Roman temple, and the chapel built of bones that is not for everyone.",
        evening: "Black pork and a heavy red. The food here is farm food, done properly.",
      }),
      move(
        stay(2, "Monsaraz", "Portugal", 38.4433, -7.3789, {
          morning: "East across the plain, through cork oak for an hour.",
          afternoon: "A white village on a hill above the largest artificial lake in Europe.",
          evening: "One of the darkest skies in Europe. Look up.",
        }),
        "East towards the Spanish border.",
        60,
        55,
      ),
      stay(3, "Monsaraz", "Portugal", 38.4433, -7.3789, {
        morning: "The lake, by boat or from the shore.",
        afternoon: "Wine estates around Reguengos. The appellation is worth the afternoon.",
        evening: "Nothing scheduled. That is the itinerary.",
      }),
      move(
        stay(4, "Comporta", "Portugal", 38.3836, -8.7842, {
          morning: "West, back across the plain and down to the coast.",
          afternoon: "Rice paddies, then dunes, then a beach that runs for sixty kilometres.",
          evening:
            "Fish grilled outside. Comporta is fashionable now but the sand has not noticed.",
        }),
        "Two hours west to the Atlantic.",
        120,
        130,
      ),
      stay(5, "Comporta", "Portugal", 38.3836, -8.7842, {
        morning: "Walk north up the beach until you cannot see anyone.",
        afternoon: "Horses on the sand, or the boardwalks through the rice.",
        evening: "Sunset here faces straight out. No hills in the way.",
      }),
      move(
        stay(6, "Setúbal", "Portugal", 38.5244, -8.8882, {
          morning: "North, over the Sado estuary.",
          afternoon: "Dolphins in the estuary, and the Arrábida ridge behind the town.",
          evening: "An hour from Lisbon airport when you are ready.",
        }),
        "Ferry across the Sado, or the long way round the head of the estuary.",
        50,
        30,
      ),
    ],
  },
];

/** Everything a theme filter needs, derived rather than duplicated. */
export const ROUTE_THEMES = [
  { id: "on-the-mountain", label: "On the mountain" },
  { id: "by-the-water", label: "By the water" },
  { id: "wine-and-gastronomy", label: "Wine and gastronomy" },
  { id: "hidden-gems", label: "Hidden gems" },
  { id: "family-escapes", label: "Family escapes" },
  { id: "city-break", label: "City break" },
  { id: "driving", label: "Driving" },
] as const;

export type RouteThemeId = (typeof ROUTE_THEMES)[number]["id"];

export function themeLabel(id: string): string {
  return ROUTE_THEMES.find((theme) => theme.id === id)?.label ?? id;
}

/** Stops are distinct places slept in, not days — two nights in one town is one stop. */
export function stopsOf(days: RouteDay[]): number {
  return new Set(days.map((day) => `${day.city}|${day.country}`)).size;
}

/** Total time in the car, for the line under the title. */
export function drivingMinutesOf(days: RouteDay[]): number {
  return days.reduce((total, day) => total + (day.driveMinutes ?? 0), 0);
}

/** Total road distance, the number a driving route is judged by. */
export function drivingKmOf(days: RouteDay[]): number {
  return days.reduce((total, day) => total + (day.driveKm ?? 0), 0);
}

/** Nights per stop, so a two-night town reads as two rather than twice. */
export function stopSummary(days: RouteDay[]): Array<{ city: string; nights: number }> {
  const out: Array<{ city: string; nights: number }> = [];
  for (const day of days) {
    const last = out[out.length - 1];
    if (last && last.city === day.city) last.nights += 1;
    else out.push({ city: day.city, nights: 1 });
  }
  return out;
}
