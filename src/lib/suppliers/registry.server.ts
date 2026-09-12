/** Which provider serves a category right now: table switch + credential. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { boltRides } from "@/lib/suppliers/rides/bolt";
import { uberRides } from "@/lib/suppliers/rides/uber";
import { openTableRestaurants } from "@/lib/suppliers/restaurants/opentable";
import { theForkRestaurants } from "@/lib/suppliers/restaurants/thefork";
import {
  unavailable,
  type AdapterResult,
  type RestaurantAdapter,
  type RideAdapter,
} from "@/lib/suppliers/types";

const RIDE_ADAPTERS: RideAdapter[] = [uberRides, boltRides];
const RESTAURANT_ADAPTERS: RestaurantAdapter[] = [theForkRestaurants, openTableRestaurants];

type Row = { category: string; provider: string; enabled: boolean; priority: number };

async function switches(supabase: SupabaseClient, category: string): Promise<Row[]> {
  const { data } = await supabase
    .from("providers")
    .select("category, provider, enabled, priority")
    .eq("category", category)
    .order("priority", { ascending: true });
  return (data ?? []) as Row[];
}

function pick<T extends { id: string; isConfigured(): boolean }>(
  adapters: T[],
  rows: Row[],
): AdapterResult<T> {
  const enabled = rows.filter((row) => row.enabled);
  if (!enabled.length) return unavailable("no-provider");
  for (const row of enabled) {
    const adapter = adapters.find((candidate) => candidate.id === row.provider);
    if (adapter?.isConfigured()) return { status: "ok", data: adapter };
  }
  return unavailable("missing-key");
}

export async function rideProvider(supabase: SupabaseClient): Promise<AdapterResult<RideAdapter>> {
  return pick(RIDE_ADAPTERS, await switches(supabase, "rides"));
}

export async function restaurantProvider(
  supabase: SupabaseClient,
): Promise<AdapterResult<RestaurantAdapter>> {
  return pick(RESTAURANT_ADAPTERS, await switches(supabase, "restaurants"));
}
