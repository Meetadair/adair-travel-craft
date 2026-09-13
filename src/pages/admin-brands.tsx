/** Admin: the airline, hotel-group and car-rental brand list customers choose from. */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldAlert } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { listBrands, saveBrand, type AdminBrandRow } from "@/lib/admin.functions";

const KINDS = [
  { value: "airline", label: "Airlines" },
  { value: "hotel_chain", label: "Hotel groups" },
  { value: "car_rental", label: "Car rental" },
] as const;

const REGIONS = ["eu", "us", "ca", "mea", "apac", "latam"] as const;
type Region = (typeof REGIONS)[number];

const REGION_LABEL: Record<Region, string> = {
  eu: "Europe",
  us: "United States",
  ca: "Canada",
  mea: "Middle East & Africa",
  apac: "Asia-Pacific",
  latam: "Latin America",
};

type Draft = {
  id: string;
  kind: (typeof KINDS)[number]["value"];
  name: string;
  group: string;
  regions: Region[];
  rank: number;
  active: boolean;
};

const emptyDraft = (kind: Draft["kind"]): Draft => ({
  id: "",
  kind,
  name: "",
  group: "",
  regions: ["eu"],
  rank: 60,
  active: true,
});

export function AdminBrandsPage() {
  const fetchBrands = useServerFn(listBrands);
  const save = useServerFn(saveBrand);
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<Draft["kind"]>("airline");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: () => fetchBrands() });
  const mutation = useMutation({
    mutationFn: (input: Draft) =>
      save({
        data: {
          id: input.id.trim().toLowerCase(),
          kind: input.kind,
          name: input.name.trim(),
          group: input.group.trim(),
          regions: input.regions,
          rank: input.rank,
          active: input.active,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
  });

  const rows = useMemo(() => {
    const all = brands.data ?? [];
    const needle = query.trim().toLowerCase();
    return all
      .filter((row) => row.kind === kind)
      .filter((row) => !needle || `${row.name} ${row.id}`.toLowerCase().includes(needle));
  }, [brands.data, kind, query]);

  const startEdit = (row: AdminBrandRow) =>
    setDraft({
      id: row.id,
      kind: row.kind as Draft["kind"],
      name: row.name,
      group: row.alliance_or_group ?? "",
      regions: (row.regions.filter((r) => (REGIONS as readonly string[]).includes(r)) as Region[])
        .length
        ? (row.regions as Region[])
        : ["eu"],
      rank: row.popularity_rank,
      active: row.active,
    });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Brands</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          What customers can pick in onboarding and settings. Rank decides the short list; regions
          decide who sees it first.
        </p>

        {brands.isError && (
          <p className="mt-8 flex items-center gap-2 text-sm text-primary">
            <ShieldAlert className="size-4" /> Admins only.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
                kind === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDraft(emptyDraft(kind))}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-primary"
          >
            <Plus className="size-3.5" /> Add brand
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this list"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        {draft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(draft);
            }}
            className="hairline-card mt-4 space-y-3 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  className="w-full bg-transparent text-sm outline-none"
                />
              </Field>
              <Field label="Id (lower-case, no spaces)">
                <input
                  value={draft.id}
                  onChange={(event) => setDraft({ ...draft, id: event.target.value })}
                  required
                  className="w-full bg-transparent text-sm outline-none"
                />
              </Field>
              <Field label="Alliance or owning group">
                <input
                  value={draft.group}
                  onChange={(event) => setDraft({ ...draft, group: event.target.value })}
                  placeholder="star, marriott, avis…"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </Field>
              <Field label="Rank (lower shows first)">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={draft.rank}
                  onChange={(event) =>
                    setDraft({ ...draft, rank: Number(event.target.value) || 100 })
                  }
                  className="w-full bg-transparent text-sm outline-none"
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => {
                const on = draft.regions.includes(region);
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        regions: on
                          ? draft.regions.filter((r) => r !== region)
                          : [...draft.regions, region],
                      })
                    }
                    className={`rounded-xl border px-3 py-1.5 text-xs ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {REGION_LABEL[region]}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              />
              Shown to customers
            </label>
            {mutation.isError && (
              <p className="text-xs text-primary">{(mutation.error as Error).message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={mutation.isPending || !draft.regions.length}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                {mutation.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <section className="hairline-card mt-4 divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <p className="min-w-0 flex-1">
                <span className="font-medium">{row.name}</span>
                <span className="block text-xs text-muted-foreground">
                  rank {row.popularity_rank} ·{" "}
                  {row.regions.length ? row.regions.join(", ") : "no region"}
                  {row.alliance_or_group ? ` · ${row.alliance_or_group}` : ""}
                  {row.active ? "" : " · hidden"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => startEdit(row)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:border-primary"
              >
                Edit
              </button>
            </div>
          ))}
          {!rows.length && !brands.isLoading && (
            <p className="p-4 text-sm text-muted-foreground">Nothing matches that search.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-xl border border-border px-3 py-2">
      <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
