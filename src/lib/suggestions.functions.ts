/**
 * Personalised example prompts for the signed-in assistant input. Signed-out
 * visitors keep the generic examples from the locale files.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CITIES } from "@/lib/trip/cities";
import {
  buildSuggestions,
  dailySeed,
  rotateSuggestions,
  type Suggestion,
  type SuggestionInput,
} from "@/lib/prompt-suggestions";
import { inSeason, reachFrom, WEEKEND_MAX_HOURS } from "@/lib/getaway/match";

/** Business cities we're happy to use in the must-arrive-by example. */
const BUSINESS_IATA = ["VIE", "MUC", "FRA", "BER", "AMS", "MIL", "LIN", "CDG", "LHR", "PRG"];

export const getPromptSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ suggestions: Suggestion[] }> => {
    const { supabase, userId } = context;

    const [profileRes, prefsRes, tripRes, companyRes] = await Promise.all([
      supabase.from("profiles").select("home_airport").eq("id", userId).maybeSingle(),
      supabase.from("preferences").select("interests").eq("user_id", userId).maybeSingle(),
      supabase
        .from("trips")
        .select("city, start_date")
        .eq("user_id", userId)
        .not("city", "is", null)
        .order("start_date", { ascending: false })
        .limit(1),
      supabase
        .from("companies")
        .select("name, is_default")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .limit(1),
    ]);

    const homeIata = (profileRes.data?.home_airport ?? "").toUpperCase();
    const homeEntry = CITIES.find((c) => c.iata === homeIata) ?? null;
    if (!homeEntry) return { suggestions: [] };

    const interests = Array.isArray(prefsRes.data?.interests)
      ? (prefsRes.data?.interests as string[])
      : [];

    // A Getaway-style example: only destinations that pass reach and season.
    const month = new Date().getUTCMonth() + 1;
    let getaway: SuggestionInput["getaway"] = null;
    const destRes = await supabase
      .from("getaway_destinations")
      .select("id, name, latitude, longitude, drivable_from")
      .eq("active", true);
    const destinations = destRes.data ?? [];
    if (destinations.length) {
      const joinRes = await supabase
        .from("getaway_destination_themes")
        .select("destination_id, season_months, getaway_themes(name, interest_tags, active)")
        .in(
          "destination_id",
          destinations.map((d) => d.id),
        );
      for (const join of joinRes.data ?? []) {
        const theme = join.getaway_themes as
          | { name: string; interest_tags: string[]; active: boolean }
          | null;
        if (!theme?.active) continue;
        if (!inSeason(join.season_months as number[], month)) continue;
        const dest = destinations.find((d) => d.id === join.destination_id);
        if (!dest) continue;
        const reach = reachFrom(
          { lat: homeEntry.lat, lon: homeEntry.lon },
          homeEntry.iata,
          { lat: Number(dest.latitude), lon: Number(dest.longitude) },
          (dest.drivable_from ?? []) as string[],
        );
        if (!reach || reach.hours > WEEKEND_MAX_HOURS) continue;
        const tags = (theme.interest_tags ?? []).map((t) => t.toLowerCase());
        const matched = interests.some((i) => tags.includes(i.toLowerCase()));
        if (!matched && interests.length) continue;
        getaway = { city: dest.name, interest: theme.name.toLowerCase() };
        break;
      }
    }

    // Nearest business city other than home, for the must-arrive-by example.
    const businessCity =
      CITIES.filter((c) => BUSINESS_IATA.includes(c.iata) && c.iata !== homeEntry.iata)
        .map((c) => ({
          city: c.city,
          reach: reachFrom(
            { lat: homeEntry.lat, lon: homeEntry.lon },
            homeEntry.iata,
            { lat: c.lat, lon: c.lon },
            [],
          ),
        }))
        .filter((c) => c.reach && c.reach.hours <= WEEKEND_MAX_HOURS)
        .sort((a, b) => (a.reach?.hours ?? 99) - (b.reach?.hours ?? 99))[0]?.city ?? null;

    const past = tripRes.data?.[0];
    const candidates = buildSuggestions({
      homeCity: homeEntry.city,
      pastTrip: past?.city ? { city: past.city, startDate: past.start_date ?? null } : null,
      companyName: companyRes.data?.[0]?.name ?? null,
      getaway,
      businessCity,
    });

    return { suggestions: rotateSuggestions(candidates, dailySeed(userId)) };
  });
