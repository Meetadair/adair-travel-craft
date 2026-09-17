/**
 * How brand lists are shown and how a chosen brand spreads across its group.
 * Pure functions — no database, no React — so the ranking is testable.
 */
import type { Brand, BrandKind, Region } from "./catalogue";
import { BRAND_SEED } from "./catalogue";

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Short list for onboarding: brands that sell in the customer's region first,
 * each kind ordered by popularity. Anything already chosen is always kept, so a
 * saved preference never disappears from the list.
 */
export function rankBrands(
  brands: Brand[],
  options: { kind: BrandKind; region: Region; limit?: number; selected?: string[] },
): Brand[] {
  const { kind, region, limit = 14, selected = [] } = options;
  const pool = brands.filter((b) => b.active && b.kind === kind);
  const scored = pool.slice().sort((a, b) => {
    const inA = a.regions.includes(region) ? 0 : 1;
    const inB = b.regions.includes(region) ? 0 : 1;
    if (inA !== inB) return inA - inB;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.name.localeCompare(b.name);
  });
  const short = scored.slice(0, limit);
  const missing = selected
    .map((id) => pool.find((b) => b.id === id))
    .filter((b): b is Brand => Boolean(b) && !short.some((s) => s!.id === b!.id));
  return [...short, ...missing];
}

/** Free-text search across the whole table, name and group. */
export function searchBrands(
  brands: Brand[],
  options: { kind: BrandKind; query: string; limit?: number },
): Brand[] {
  const { kind, query, limit = 30 } = options;
  const needle = fold(query);
  const pool = brands.filter((b) => b.active && b.kind === kind);
  if (!needle)
    return pool
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  return pool
    .filter((b) =>
      fold(`${b.name} ${b.group ?? ""} ${(b.aliases ?? []).join(" ")}`).includes(needle),
    )
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

/**
 * Every brand that shares an alliance or owning group with the chosen one —
 * pick Marriott and Westin counts, pick LOT and Lufthansa and United earn too.
 */
export function brandsInSameGroup(brands: Brand[], brandId: string): Brand[] {
  const brand = brands.find((b) => b.id === brandId);
  if (!brand || !brand.group) return brand ? [brand] : [];
  return brands.filter((b) => b.kind === brand.kind && b.group === brand.group);
}

/**
 * Does a supplier name earn on the customer's chosen brand, counting the whole
 * group? Used by the loyalty pass-through alongside the editable rule table.
 */
export function earnsOnBrandGroup(
  brands: Brand[],
  brandId: string,
  supplier: string | null | undefined,
): boolean {
  if (!supplier) return false;
  const haystack = fold(supplier);
  return brandsInSameGroup(brands, brandId).some((b) =>
    [b.name, ...(b.aliases ?? [])].some((word) => haystack.includes(fold(word))),
  );
}

/** Labels for a stored list of brand ids, falling back to the seed catalogue. */
export function brandLabels(ids: string[], brands: Brand[] = BRAND_SEED): string[] {
  return ids.map((id) => brands.find((b) => b.id === id)?.name ?? id);
}
