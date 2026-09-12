/** Help: send a request with the trip attached, and see the ones already sent. */
import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import { listMyTrips } from "@/lib/booking.functions";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_URGENCIES,
  createSupportRequest,
  listMySupportRequests,
} from "@/lib/support.functions";

export function SupportPage() {
  const search = useSearch({ from: "/_authenticated/support" });
  const fetchTrips = useServerFn(listMyTrips);
  const fetchRequests = useServerFn(listMySupportRequests);
  const send = useServerFn(createSupportRequest);
  const queryClient = useQueryClient();

  const trips = useQuery({ queryKey: ["my-trips"], queryFn: () => fetchTrips({}) });
  const requests = useQuery({ queryKey: ["support-requests"], queryFn: () => fetchRequests() });

  const [tripId, setTripId] = useState<string>(search.trip ?? "");
  const [category, setCategory] = useState<string>(search.category ?? "other");
  const [urgency, setUrgency] = useState("normal");
  const [description, setDescription] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          tripId: tripId || null,
          category: category as "change",
          urgency: urgency as "normal",
          description,
        },
      }),
    onSuccess: () => {
      setDone(true);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["support-requests"] });
    },
  });

  const field = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm";

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
          <LifeBuoy className="size-6 text-primary" /> Help
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us what is happening and we will reply by email.
        </p>

        {done && (
          <p className="mt-6 rounded-xl border border-border px-4 py-3 text-sm">
            We&apos;ve received it. We&apos;ll reply by email.
          </p>
        )}

        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setDone(false);
            mutation.mutate();
          }}
        >
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="support-trip">
              Which trip?
            </label>
            <select
              id="support-trip"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className={field}
            >
              <option value="">Not about a specific trip</option>
              {(trips.data ?? []).map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                  {trip.reference ? ` · ${trip.reference}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="support-category">
              What do you need?
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={field}
            >
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs text-muted-foreground">How urgent is it?</span>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_URGENCIES.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  aria-pressed={urgency === u.value}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-sm ${
                    urgency === u.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground" htmlFor="support-text">
              What happened?
            </label>
            <textarea
              id="support-text"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={field}
              placeholder="My 6:20 flight was cancelled at the gate."
            />
          </div>

          <button
            type="submit"
            disabled={description.trim().length < 5 || mutation.isPending}
            className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {mutation.isPending ? "Sending…" : "Send"}
          </button>
          {mutation.isError && (
            <p className="text-sm text-primary">We could not send that. Please try again.</p>
          )}
        </form>

        {(requests.data?.length ?? 0) > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-semibold">Your requests</h2>
            <ul className="mt-4 space-y-3">
              {requests.data?.map((r) => (
                <li key={r.id} className="hairline-card p-4">
                  <p className="text-sm font-medium">
                    {SUPPORT_CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                    {r.tripReference ? ` · ${r.tripReference}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.status} · {r.createdAt.slice(0, 10)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
