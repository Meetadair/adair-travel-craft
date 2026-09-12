/**
 * /admin/getaway — full editorial control of the Getaway library without a
 * developer: themes, destinations, theme assignments with their own season
 * window, curated places and day-by-day itineraries, each with an active
 * toggle so content can be drafted before it goes live.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TIP_CATEGORIES } from "@/lib/trip/tips";
import { SiteNav } from "@/components/site-nav";
import { GetawayImageEditor } from "@/components/admin/getaway-image-editor";
import {
  getGetawayContent,
  saveGetawayDestination,
  saveGetawayItinerary,
  saveGetawayPlace,
  saveGetawayTheme,
  saveGetawayThemeAssignment,
  getGetawayItineraryDays,
  saveGetawayItineraryDay,
  type AdminDestination,
  type AdminTheme,
} from "@/lib/admin-getaway.functions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

function MonthPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {MONTHS.map((label, index) => {
        const month = index + 1;
        const on = value.includes(month);
        return (
          <button
            key={month}
            type="button"
            onClick={() => onChange(on ? value.filter((m) => m !== month) : [...value, month].sort((a, b) => a - b))}
            className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs ${
              on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminGetawayPage() {
  const fetchContent = useServerFn(getGetawayContent);
  const persistTheme = useServerFn(saveGetawayTheme);
  const persistDestination = useServerFn(saveGetawayDestination);
  const persistAssignment = useServerFn(saveGetawayThemeAssignment);
  const persistPlace = useServerFn(saveGetawayPlace);
  const persistItinerary = useServerFn(saveGetawayItinerary);
  const queryClient = useQueryClient();
  const content = useQuery({ queryKey: ["admin-getaway"], queryFn: () => fetchContent({}) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-getaway"] });

  const themeMutation = useMutation({
    mutationFn: (data: Parameters<typeof persistTheme>[0] extends never ? never : Record<string, unknown>) =>
      persistTheme({ data: data as never }),
    onSuccess: refresh,
  });
  const destMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => persistDestination({ data: data as never }),
    onSuccess: refresh,
  });
  const assignMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => persistAssignment({ data: data as never }),
    onSuccess: refresh,
  });
  const placeMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => persistPlace({ data: data as never }),
    onSuccess: refresh,
  });
  const itinMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => persistItinerary({ data: data as never }),
    onSuccess: refresh,
  });

  const [openDest, setOpenDest] = useState<string | null>(null);
  const themes = content.data?.themes ?? [];
  const destinations = content.data?.destinations ?? [];
  const gaps = destinations.filter((d) => d.places.length === 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Getaway editorial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Themes, destinations, seasons, curated places and day-by-day routes. Nothing appears to
          travellers until it is active.
        </p>

        {content.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
        {content.isError && (
          <p className="mt-8 text-sm text-muted-foreground">
            {(content.error as Error).message}
          </p>
        )}

        {gaps.length > 0 && (
          <section className="hairline-card mt-8 p-5">
            <h2 className="text-sm font-semibold">Destinations with no curated places yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">{gaps.map((d) => d.name).join(", ")}</p>
          </section>
        )}

        <ThemeEditor themes={themes} onSave={(data) => themeMutation.mutate(data)} />

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Destinations</h2>
          <NewDestination onSave={(data) => destMutation.mutate(data)} />
          <ul className="mt-5 space-y-3">
            {destinations.map((dest) => (
              <li key={dest.id} className="hairline-card p-5">
                <button
                  type="button"
                  onClick={() => setOpenDest(openDest === dest.id ? null : dest.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-medium">{dest.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {dest.country} · {dest.nearest_airport_iata} · {dest.themes.length} themes ·{" "}
                      {dest.places.length} places
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dest.active ? "active" : "draft"}
                  </span>
                </button>
                {openDest === dest.id && (
                  <DestinationEditor
                    onRefresh={refresh}
                    dest={dest}
                    themes={themes}
                    onSaveDest={(data) => destMutation.mutate(data)}
                    onSaveAssignment={(data) => assignMutation.mutate(data)}
                    onSavePlace={(data) => placeMutation.mutate(data)}
                    onSaveItinerary={(data) => itinMutation.mutate(data)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function ThemeEditor({
  themes,
  onSave,
}: {
  themes: AdminTheme[];
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({ slug: "", name: "", tags: "", months: [] as number[] });
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold">Themes</h2>
      <ul className="mt-4 space-y-3">
        {themes.map((theme) => (
          <li key={theme.id} className="hairline-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {theme.name} <span className="text-xs text-muted-foreground">{theme.slug}</span>
              </p>
              <button
                type="button"
                onClick={() => onSave({ ...theme, active: !theme.active })}
                className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {theme.active ? "Active — switch off" : "Draft — make active"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tags: {theme.interest_tags.join(", ") || "none"}
            </p>
            <MonthPicker
              value={theme.season_months}
              onChange={(months) => onSave({ ...theme, season_months: months })}
            />
            <textarea
              defaultValue={theme.description ?? ""}
              placeholder="Description for the team"
              onBlur={(e) => onSave({ ...theme, description: e.target.value || null })}
              className={`${inputClass} min-h-16`}
            />
          </li>
        ))}
      </ul>

      <div className="hairline-card mt-4 p-5">
        <p className="text-sm font-medium">New theme</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Slug" value={draft.slug} onChange={(v) => setDraft({ ...draft, slug: v })} />
          <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        </div>
        <Field
          label="Interest tags (comma separated)"
          value={draft.tags}
          onChange={(v) => setDraft({ ...draft, tags: v })}
        />
        <MonthPicker value={draft.months} onChange={(months) => setDraft({ ...draft, months })} />
        <button
          type="button"
          disabled={!draft.slug || !draft.name}
          onClick={() =>
            onSave({
              slug: draft.slug,
              name: draft.name,
              description: null,
              interest_tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
              season_months: draft.months,
              sort_order: themes.length + 1,
              active: false,
            })
          }
          className="mt-4 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Add theme
        </button>
      </div>
    </section>
  );
}

function NewDestination({ onSave }: { onSave: (data: Record<string, unknown>) => void }) {
  const [d, setD] = useState({ name: "", country: "", iata: "", lat: "", lon: "", nights: "3" });
  const ready = d.name && d.country && d.iata.length === 3 && d.lat && d.lon;
  return (
    <div className="hairline-card mt-4 p-5">
      <p className="text-sm font-medium">New destination</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={d.name} onChange={(v) => setD({ ...d, name: v })} />
        <Field label="Country" value={d.country} onChange={(v) => setD({ ...d, country: v })} />
        <Field label="Nearest airport (IATA)" value={d.iata} onChange={(v) => setD({ ...d, iata: v })} />
        <Field label="Typical nights" value={d.nights} onChange={(v) => setD({ ...d, nights: v })} />
        <Field label="Latitude" value={d.lat} onChange={(v) => setD({ ...d, lat: v })} />
        <Field label="Longitude" value={d.lon} onChange={(v) => setD({ ...d, lon: v })} />
      </div>
      <button
        type="button"
        disabled={!ready}
        onClick={() =>
          onSave({
            name: d.name,
            country: d.country,
            nearest_airport_iata: d.iata,
            latitude: Number(d.lat),
            longitude: Number(d.lon),
            drivable_from: [],
            editorial_note: null,
            best_for: null,
            avoid_when: null,
            travel_tips: {},
            typical_nights: Number(d.nights) || 3,
            active: false,
          })
        }
        className="mt-4 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Add destination
      </button>
    </div>
  );
}

function DestinationEditor({
  dest,
  themes,
  onSaveDest,
  onRefresh,
  onSaveAssignment,
  onSavePlace,
  onSaveItinerary,
}: {
  dest: AdminDestination;
  themes: AdminTheme[];
  onSaveDest: (data: Record<string, unknown>) => void;
  onRefresh: () => void;
  onSaveAssignment: (data: Record<string, unknown>) => void;
  onSavePlace: (data: Record<string, unknown>) => void;
  onSaveItinerary: (data: Record<string, unknown>) => void;
}) {
  const base = {
    id: dest.id,
    name: dest.name,
    country: dest.country,
    nearest_airport_iata: dest.nearest_airport_iata,
    latitude: dest.latitude,
    longitude: dest.longitude,
    drivable_from: dest.drivable_from,
    editorial_note: dest.editorial_note,
    best_for: dest.best_for,
    avoid_when: dest.avoid_when,
    travel_tips: dest.travel_tips,
    typical_nights: dest.typical_nights,
    active: dest.active,
  };
  const [place, setPlace] = useState({ kind: "hotel", name: "", address: "", why: "" });
  const [itin, setItin] = useState({ title: "", nights: "2", summary: "" });

  return (
    <div className="mt-5 space-y-6 border-t border-border pt-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSaveDest({ ...base, active: !dest.active })}
          className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
        >
          {dest.active ? "Active — switch off" : "Draft — make active"}
        </button>
      </div>

      <div>
        <p className="text-sm font-medium">Hero picture</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Our own photo from a real trip beats stock. Shown across the page top and at the top of the
          weekly email.
        </p>
        <GetawayImageEditor
          target={{ kind: "destination", id: dest.id }}
          query={`${dest.name} ${dest.country}`}
          imageUrl={dest.hero_image_url}
          credit={dest.hero_image_credit}
          source={dest.hero_image_source}
          onChanged={onRefresh}
        />
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground">Editorial note</span>
        <textarea
          defaultValue={dest.editorial_note ?? ""}
          placeholder="Why this place is worth going — written by the team"
          onBlur={(e) => onSaveDest({ ...base, editorial_note: e.target.value || null })}
          className={`${inputClass} min-h-24`}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Best for</span>
            <input
              defaultValue={dest.best_for ?? ""}
              onBlur={(e) => onSaveDest({ ...base, best_for: e.target.value || null })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Avoid when</span>
            <input
              defaultValue={dest.avoid_when ?? ""}
              onBlur={(e) => onSaveDest({ ...base, avoid_when: e.target.value || null })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Drivable from (IATA, comma separated)
            </span>
            <input
              defaultValue={dest.drivable_from.join(", ")}
              onBlur={(e) =>
                onSaveDest({
                  ...base,
                  drivable_from: e.target.value
                    .split(",")
                    .map((v) => v.trim().toUpperCase())
                    .filter((v) => v.length === 3),
                })
              }
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Typical nights</span>
            <input
              defaultValue={String(dest.typical_nights)}
              onBlur={(e) =>
                onSaveDest({ ...base, typical_nights: Number(e.target.value) || dest.typical_nights })
              }
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Travel tips</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on the traveller&rsquo;s booked trip. Leave a box empty and nothing is shown.
        </p>
        <div className="mt-3 grid gap-3">
          {TIP_CATEGORIES.map((category) => (
            <label key={category.key} className="block">
              <span className="text-xs font-medium text-muted-foreground">{category.label}</span>
              <textarea
                defaultValue={dest.travel_tips[category.key] ?? ""}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  const next = { ...dest.travel_tips };
                  if (text) next[category.key] = text;
                  else delete next[category.key];
                  onSaveDest({ ...base, travel_tips: next });
                }}
                className={`${inputClass} min-h-20`}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Themes & seasons</p>
        <ul className="mt-3 space-y-3">
          {themes.map((theme) => {
            const assigned = dest.themes.find((t) => t.theme_id === theme.id);
            return (
              <li key={theme.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm">{theme.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveAssignment({
                        destination_id: dest.id,
                        theme_id: theme.id,
                        season_months: assigned ? assigned.season_months : theme.season_months,
                        editorial_angle: assigned?.editorial_angle ?? null,
                        remove: Boolean(assigned),
                      })
                    }
                    className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
                  >
                    {assigned ? "Remove" : "Assign"}
                  </button>
                </div>
                {assigned && (
                  <>
                    <MonthPicker
                      value={assigned.season_months}
                      onChange={(months) =>
                        onSaveAssignment({
                          destination_id: dest.id,
                          theme_id: theme.id,
                          season_months: months,
                          editorial_angle: assigned.editorial_angle,
                        })
                      }
                    />
                    <input
                      defaultValue={assigned.editorial_angle ?? ""}
                      placeholder="Editorial angle for this theme"
                      onBlur={(e) =>
                        onSaveAssignment({
                          destination_id: dest.id,
                          theme_id: theme.id,
                          season_months: assigned.season_months,
                          editorial_angle: e.target.value || null,
                        })
                      }
                      className={inputClass}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-sm font-medium">Curated places</p>
        {dest.places.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Nothing curated here yet.</p>
        )}
        <ul className="mt-3 space-y-2">
          {dest.places.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <span className="text-sm">
                {p.name} <span className="text-xs text-muted-foreground">{p.kind}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onSavePlace({
                    id: p.id,
                    destination_id: dest.id,
                    kind: p.kind,
                    name: p.name,
                    address: null,
                    latitude: null,
                    longitude: null,
                    editorial_note: null,
                    why_this_one: p.why_this_one,
                    price_band: null,
                    family_friendly: false,
                    active: p.active,
                    remove: true,
                  })
                }
                className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Kind</span>
            <select
              value={place.kind}
              onChange={(e) => setPlace({ ...place, kind: e.target.value })}
              className={inputClass}
            >
              <option value="hotel">hotel</option>
              <option value="restaurant">restaurant</option>
              <option value="sight">sight</option>
            </select>
          </label>
          <Field label="Name" value={place.name} onChange={(v) => setPlace({ ...place, name: v })} />
          <Field label="Address" value={place.address} onChange={(v) => setPlace({ ...place, address: v })} />
          <Field label="Why this one" value={place.why} onChange={(v) => setPlace({ ...place, why: v })} />
        </div>
        <button
          type="button"
          disabled={place.name.length < 2}
          onClick={() => {
            onSavePlace({
              destination_id: dest.id,
              kind: place.kind,
              name: place.name,
              address: place.address || null,
              latitude: null,
              longitude: null,
              editorial_note: null,
              why_this_one: place.why || null,
              price_band: null,
              family_friendly: false,
              active: true,
            });
            setPlace({ kind: "hotel", name: "", address: "", why: "" });
          }}
          className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Add place
        </button>
      </div>

      <div>
        <p className="text-sm font-medium">Itineraries</p>
        <ul className="mt-3 space-y-2">
          {dest.itineraries.map((i) => (
            <li key={i.id} className="rounded-xl border border-border p-3">
              <p className="text-sm">
                {i.title} <span className="text-xs text-muted-foreground">{i.nights} nights</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onSaveItinerary({
                      id: i.id,
                      destination_id: dest.id,
                      title: i.title,
                      nights: i.nights,
                      summary: i.summary,
                      active: !i.active,
                    })
                  }
                  className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  {i.active ? "Active — switch off" : "Draft — make active"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSaveItinerary({
                      id: i.id,
                      destination_id: dest.id,
                      title: i.title,
                      nights: i.nights,
                      summary: i.summary,
                      active: i.active,
                      remove: true,
                    })
                  }
                  className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs"
                >
                  Delete
                </button>
              </div>
              <ItineraryDays
                itineraryId={i.id}
                nights={i.nights}
                places={dest.places}
                destinationName={dest.name}
              />
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Title" value={itin.title} onChange={(v) => setItin({ ...itin, title: v })} />
          <Field label="Nights" value={itin.nights} onChange={(v) => setItin({ ...itin, nights: v })} />
        </div>
        <button
          type="button"
          disabled={itin.title.length < 2}
          onClick={() => {
            onSaveItinerary({
              destination_id: dest.id,
              title: itin.title,
              nights: Number(itin.nights) || 2,
              summary: itin.summary || null,
              active: false,
            });
            setItin({ title: "", nights: "2", summary: "" });
          }}
          className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Add itinerary
        </button>
      </div>
    </div>
  );
}

function ItineraryDays({
  itineraryId,
  nights,
  places,
  destinationName,
}: {
  itineraryId: string;
  nights: number;
  places: AdminDestination["places"];
  destinationName: string;
}) {
  const fetchDays = useServerFn(getGetawayItineraryDays);
  const persistDay = useServerFn(saveGetawayItineraryDay);
  const queryClient = useQueryClient();
  const days = useQuery({
    queryKey: ["getaway-days", itineraryId],
    queryFn: () => fetchDays({ data: { itineraryId } }),
  });
  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => persistDay({ data: data as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["getaway-days", itineraryId] }),
  });

  return (
    <div className="mt-3 space-y-3">
      {Array.from({ length: nights + 1 }, (_, i) => i + 1).map((dayNumber) => {
        const row = days.data?.find((d) => d.day_number === dayNumber);
        const current = {
          itinerary_id: itineraryId,
          day_number: dayNumber,
          morning: row?.morning ?? null,
          afternoon: row?.afternoon ?? null,
          evening: row?.evening ?? null,
          sleep_place_id: row?.sleep_place_id ?? null,
          meal_place_ids: row?.meal_place_ids ?? [],
        };
        return (
          <div key={dayNumber} className="rounded-xl border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Day {dayNumber}</p>
            {(["morning", "afternoon", "evening"] as const).map((slot) => (
              <input
                key={slot}
                defaultValue={current[slot] ?? ""}
                placeholder={slot}
                onBlur={(e) => save.mutate({ ...current, [slot]: e.target.value || null })}
                className={inputClass}
              />
            ))}
            <select
              value={current.sleep_place_id ?? ""}
              onChange={(e) => save.mutate({ ...current, sleep_place_id: e.target.value || null })}
              className={inputClass}
            >
              <option value="">Sleep — no place chosen</option>
              {places
                .filter((p) => p.kind === "hotel")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            {row ? (
              <GetawayImageEditor
                compact
                target={{ kind: "day", id: row.id }}
                query={`${destinationName} ${row.morning ?? row.afternoon ?? ""}`.trim()}
                imageUrl={row.image_url}
                credit={row.image_credit}
                source={row.image_source}
                onChanged={() =>
                  queryClient.invalidateQueries({ queryKey: ["getaway-days", itineraryId] })
                }
              />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Save something for this day to add a picture.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
