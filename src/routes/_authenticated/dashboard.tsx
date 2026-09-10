import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileDown, Plane, BedDouble, CarFront, Trash2, LogOut } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { supabase } from "@/integrations/supabase/client";
import { listTrips, deleteTrip, getProfile, saveProfile } from "@/lib/travel.functions";
import { downloadTripInvoice } from "@/lib/trip-pdf";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Adair client dashboard — trips and invoices" },
      {
        name: "description",
        content:
          "Your saved Adair trips, travel preferences, and invoices available for PDF download.",
      },
      { property: "og:title", content: "Adair client dashboard" },
      {
        property: "og:description",
        content: "Trips, preferences, and invoices in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanelPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-6 py-24 text-sm text-muted-foreground">
      We couldn't load the dashboard. Please refresh the page.
    </div>
  ),
});

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
};

const money = (amount: number, currency: string) =>
  `${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

function PanelPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchTrips = useServerFn(listTrips);
  const fetchProfile = useServerFn(getProfile);
  const persistProfile = useServerFn(saveProfile);
  const removeTrip = useServerFn(deleteTrip);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const trips = useQuery({ queryKey: ["trips"], queryFn: () => fetchTrips({}) });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile({}) });

  const [form, setForm] = useState({
    full_name: "",
    company: "",
    tax_id: "",
    preferred_airlines: "",
    cabin_class: "",
    seat_preference: "",
    hotel_chains: "",
    diet: "",
    budget_per_trip: "",
    currency: "EUR",
  });

  useEffect(() => {
    if (!profile.data) return;
    const p = profile.data;
    setForm({
      full_name: p.full_name ?? "",
      company: p.company ?? "",
      tax_id: p.tax_id ?? "",
      preferred_airlines: p.preferred_airlines ?? "",
      cabin_class: p.cabin_class ?? "",
      seat_preference: p.seat_preference ?? "",
      hotel_chains: p.hotel_chains ?? "",
      diet: p.diet ?? "",
      budget_per_trip: p.budget_per_trip ? String(p.budget_per_trip) : "",
      currency: p.currency ?? "EUR",
    });
  }, [profile.data]);

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      persistProfile({
        data: {
          full_name: form.full_name || null,
          company: form.company || null,
          tax_id: form.tax_id || null,
          preferred_airlines: form.preferred_airlines || null,
          cabin_class: form.cabin_class || null,
          seat_preference: form.seat_preference || null,
          hotel_chains: form.hotel_chains || null,
          diet: form.diet || null,
          budget_per_trip: form.budget_per_trip ? Number(form.budget_per_trip) : null,
          currency: form.currency || "EUR",
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeTrip({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trips"] }),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const field = (key: keyof typeof form, label: string, placeholder?: string) => (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              My trips
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{email}</p>
          </div>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>

        {trips.isLoading && (
          <p className="mt-10 text-sm text-muted-foreground">Loading trips…</p>
        )}

        {trips.data?.length === 0 && (
          <div className="hairline-card mt-10 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You don't have any saved trips yet.
            </p>
            <button
              onClick={() => navigate({ to: "/assistant" })}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Book your first trip
            </button>
          </div>
        )}

        <div className="mt-10 space-y-6">
          {trips.data?.map((trip) => (
            <div key={trip.id} className="hairline-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
                <div>
                  <p className="text-sm font-semibold">{trip.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {trip.origin} → {trip.city} · {trip.start_date} – {trip.end_date} ·{" "}
                    {trip.document_number}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">
                    {money(Number(trip.total_amount), trip.currency)}
                  </span>
                  <button
                    onClick={() =>
                      downloadTripInvoice({
                        documentNumber: trip.document_number ?? `ADR/${trip.id.slice(0, 6)}`,
                        issueDate: new Date(trip.created_at).toISOString().slice(0, 10),
                        city: trip.city ?? "",
                        origin: trip.origin ?? "",
                        startDate: trip.start_date ?? "",
                        endDate: trip.end_date ?? "",
                        currency: trip.currency,
                        live: trip.data_source !== "demo",
                        buyer: {
                          name: form.full_name,
                          company: form.company,
                          taxId: form.tax_id,
                          email,
                        },
                        items: trip.items.map((i) => ({
                          kind: i.kind,
                          title: i.title,
                          detail: i.detail ?? "",
                          provider: i.provider ?? "",
                          offerReference: i.offer_reference ?? "",
                          amount: Number(i.amount),
                          currency: i.currency,
                        })),
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <FileDown className="size-4" /> Download invoice (PDF)
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(trip.id)}
                    aria-label="Delete trip"
                    className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {trip.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
                      {ICONS[item.kind]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {item.provider} · {item.offer_reference}
                    </p>
                    <p className="w-24 text-right text-sm font-semibold">
                      {money(Number(item.amount), item.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Travel profile
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set it once — every future trip and invoice will follow these preferences.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveProfileMutation.mutate();
            }}
            className="hairline-card mt-8 grid gap-5 p-6 sm:grid-cols-2"
          >
            {field("full_name", "Full name")}
            {field("company", "Company (invoice bill-to)")}
            {field("tax_id", "VAT number")}
            {field("preferred_airlines", "Preferred airlines", "LOT, Lufthansa")}
            {field("cabin_class", "Cabin class", "premium economy")}
            {field("seat_preference", "Seat preference", "window, front")}
            {field("hotel_chains", "Hotel chains", "Hyatt, SLH")}
            {field("diet", "Diet", "gluten-free")}
            {field("budget_per_trip", "Budget per trip", "1500")}
            {field("currency", "Currency", "EUR")}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saveProfileMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saveProfileMutation.isPending ? "Saving…" : "Save preferences"}
              </button>
              {saveProfileMutation.isSuccess && (
                <span className="ml-3 text-sm text-muted-foreground">Saved.</span>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
