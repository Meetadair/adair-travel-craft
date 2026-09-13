/**
 * Reads the brand table from the browser (anyone may read the active rows) and
 * falls back to the built-in catalogue if the table cannot be reached, so the
 * onboarding question always has something to show.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_SEED, type Brand, type BrandKind } from "./catalogue";

type Row = {
  id: string;
  kind: string;
  name: string;
  alliance_or_group: string | null;
  regions: string[] | null;
  aliases: string[] | null;
  popularity_rank: number | null;
  active: boolean;
};

const toBrand = (row: Row): Brand => ({
  id: row.id,
  kind: row.kind as BrandKind,
  name: row.name,
  group: row.alliance_or_group,
  regions: (row.regions ?? []) as Brand["regions"],
  rank: row.popularity_rank ?? 100,
  active: row.active,
  aliases: row.aliases ?? [],
});

export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("id, kind, name, alliance_or_group, regions, aliases, popularity_rank, active")
    .eq("active", true)
    .order("popularity_rank", { ascending: true });
  if (error || !data?.length) return BRAND_SEED;
  return (data as Row[]).map(toBrand);
}

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: fetchBrands,
    staleTime: 10 * 60 * 1000,
    initialData: BRAND_SEED,
  });
}
