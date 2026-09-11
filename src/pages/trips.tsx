import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plane, BedDouble, CarFront, X } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { listMyTrips, cancelTripItem } from "@/lib/booking.functions";
import { eur } from "@/lib/trip/client";

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  stay: <BedDouble className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
};

export function TripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchTrips = useServerFn(listMyTrips);
  const cancelItem = useServerFn(cancelTripItem);

  const trips = useQuery({ queryKey: ["my-trips"], queryFn: () => fetchTrips({}) });

  const cancel = useMutation({
    mutationFn: (itemId: string) => cancelItem({ data: { itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-trips"] }),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">My trips</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you booked, with its confirmation and status.
        </p>

        {trips.isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading…</p>}

        {trips.data?.length === 0 && (
          <div className="hairline-card mt-10 p-8 text-center">
            <p className="text-sm text-muted-foreground">No trips yet.</p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Plan a trip
            </button>
          </div>
        )}

        <div className="mt-10 space-y-6">
          {trips.data?.map((trip) => (
            <article key={trip.id} className="hairline-card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">{trip.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trip.status}
                    {trip.reference ? ` · ${trip.reference}` : ""}
                  </p>
                </div>
                <span className="font-display text-lg font-semibold text-primary">
                  {eur(trip.totalEur)}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {trip.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="text-muted-foreground">{ICONS[item.kind] ?? null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.status}
                        {item.reference ? ` · ${item.reference}` : ""}
                      </span>
                    </span>
                    <span className="text-sm">{eur(item.amountEur)}</span>
                    {item.status !== "cancelled" && (
                      <button
                        onClick={() => cancel.mutate(item.id)}
                        disabled={cancel.isPending}
                        aria-label={`Cancel ${item.title}`}
                        className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
