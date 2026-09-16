/**
 * Brand chooser for airlines, hotel groups and rental companies. Onboarding gets
 * a short list ranked by the customer's home-airport region plus a search field
 * that reaches the whole table; Settings gets the full searchable list.
 */
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { regionForAirport, type BrandKind } from "@/lib/brands/catalogue";
import { rankBrands, searchBrands } from "@/lib/brands/ranking";
import { useBrands } from "@/lib/brands/store";

const base =
  "flex min-h-12 items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors motion-reduce:transition-none";
const on = "border-primary bg-primary/5 font-medium text-foreground";
const off = "border-border bg-background hover:border-foreground/30";

const REGION_NOTE: Record<string, string> = {
  eu: "Ranked for where you fly from — search for any other",
  us: "Ranked for where you fly from — search for any other",
};

export function BrandPicker({
  kind,
  value,
  onChange,
  homeAirport,
  noneValue = "none",
  fullList = false,
}: {
  kind: BrandKind;
  value: string[];
  onChange: (next: string[]) => void;
  homeAirport?: string;
  noneValue?: string;
  fullList?: boolean;
}) {
  const [query, setQuery] = useState("");
  // The short list is fourteen names ranked for where they fly from. Everything
  // else was reachable only by typing into the search box, and people read a
  // short list as the whole list — so the rest is one button away now.
  const [showAll, setShowAll] = useState(false);
  const brands = useBrands().data;
  const region = regionForAirport(homeAirport);

  const expanded = fullList || showAll;
  const total = useMemo(
    () => brands.filter((b) => b.active && b.kind === kind).length,
    [brands, kind],
  );

  const shown = useMemo(() => {
    if (query.trim()) return searchBrands(brands, { kind, query, limit: 30 });
    if (expanded) return searchBrands(brands, { kind, query: "", limit: 400 });
    return rankBrands(brands, { kind, region, limit: 14, selected: value });
  }, [brands, kind, query, expanded, region, value]);

  const noPreference = value.includes(noneValue);

  const toggle = (id: string) => {
    if (id === noneValue) {
      onChange(noPreference ? [] : [noneValue]);
      return;
    }
    const without = value.filter((v) => v !== noneValue);
    onChange(without.includes(id) ? without.filter((v) => v !== id) : [...without, id]);
  };

  const chosen = value.filter((v) => v !== noneValue);

  return (
    <div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or group"
          aria-label="Search brands"
          className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none focus:border-primary"
        />
      </label>

      {!expanded && !query.trim() && (
        <p className="mt-2 text-xs text-muted-foreground">
          {REGION_NOTE[region] ?? "Ranked for where you fly from — search for any other"}
        </p>
      )}

      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chosen.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="rounded-full border border-primary bg-primary/5 px-3 py-1 text-xs font-medium"
            >
              {brands.find((b) => b.id === id)?.name ?? id} ×
            </button>
          ))}
        </div>
      )}

      <div className={`mt-3 grid gap-2 sm:grid-cols-2 ${expanded ? "max-h-96 overflow-y-auto pr-1" : ""}`}>
        <button
          type="button"
          onClick={() => toggle(noneValue)}
          className={`${base} ${noPreference ? on : off}`}
        >
          <span>No preference</span>
          {noPreference && <Check className="size-4 shrink-0 text-primary" />}
        </button>
        {shown.map((brand) => {
          const selected = value.includes(brand.id);
          return (
            <button
              key={brand.id}
              type="button"
              onClick={() => toggle(brand.id)}
              className={`${base} ${selected ? on : off}`}
            >
              <span>
                {brand.name}
                {brand.group && brand.group !== brand.name && (
                  <span className="block text-xs text-muted-foreground">{brand.group}</span>
                )}
              </span>
              {selected && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
        {!shown.length && (
          <p className="text-sm text-muted-foreground">Nothing matches “{query}”.</p>
        )}
      </div>

      {!fullList && !query.trim() && (showAll || total > shown.length) && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {showAll ? "Show the usual ones" : `Show all ${total}`}
        </button>
      )}
    </div>
  );
}
