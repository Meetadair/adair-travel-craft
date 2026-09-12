import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plane,
  BedDouble,
  CarFront,
  CarTaxiFront,
  ShieldCheck,
  UtensilsCrossed,
  X,
  FileText,
  FileDown,
} from "lucide-react";
import { AddReservation } from "@/components/add-reservation";
import { SiteNav } from "@/components/site-nav";
import { AppFooter } from "@/components/app-footer";
import { AddToCalendar } from "@/components/add-to-calendar";
import { TripRoute } from "@/components/trip-route";
import { MapPin } from "lucide-react";
import { TripMonthCalendar } from "@/components/trip-month-calendar";
import { listMyTrips, cancelTripItem, type MyTrip } from "@/lib/booking.functions";
import { listMyInvoices } from "@/lib/invoices.functions";
import { downloadInvoiceFor } from "@/lib/invoice-download";
import { useLocale } from "@/lib/i18n";
import { tripCalendarEvents } from "@/lib/calendar";
import { eur } from "@/lib/trip/client";

const ICONS: Record<string, React.ReactNode> = {
  flight: <Plane className="size-4" />,
  stay: <BedDouble className="size-4" />,
  hotel: <BedDouble className="size-4" />,
  car: <CarFront className="size-4" />,
  insurance: <ShieldCheck className="size-4" />,
  ride: <CarTaxiFront className="size-4" />,
  restaurant: <UtensilsCrossed className="size-4" />,
};

function eventsFor(trip: MyTrip) {
  return tripCalendarEvents({
    id: trip.id,
    title: trip.title,
    city: trip.city,
    startDate: trip.startDate,
    endDate: trip.endDate,
    reference: trip.reference,
    items: trip.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      status: item.status,
      reference: item.reference,
      payload: item.payload,
    })),
  });
}

export function TripsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const fetchTrips = useServerFn(listMyTrips);
  const fetchInvoices = useServerFn(listMyInvoices);
  const invoices = useQuery({ queryKey: ["my-invoices"], queryFn: () => fetchInvoices({}) });
  const cancelItem = useServerFn(cancelTripItem);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [mapFor, setMapFor] = useState<string | null>(null);
  const [order, setOrder] = useState<Record<string, MyTrip["stops"]>>({});

  const trips = useQuery({ queryKey: ["my-trips"], queryFn: () => fetchTrips({}) });

  const cancel = useMutation({
    mutationFn: (itemId: string) => cancelItem({ data: { itemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-trips"] }),
  });


  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">My trips</h1>
          <Link
            to="/preferences"
            className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Travel preferences
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you booked, with its confirmation and status.
        </p>

        <div className="mt-6 inline-flex rounded-xl border border-border p-1">
          {(["list", "calendar"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium capitalize ${
                view === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>


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

        {view === "calendar" && (trips.data?.length ?? 0) > 0 && (
          <div className="mt-10">
            <TripMonthCalendar trips={trips.data ?? []} />
          </div>
        )}

        <div className={`mt-10 space-y-6 ${view === "calendar" ? "hidden" : ""}`}>

          {trips.data?.map((trip) => (
            <article key={trip.id} className="hairline-card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">{trip.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {trip.status}
                      {trip.reference ? ` · ${trip.reference}` : ""}
                    </span>
                    {trip.testMode && (
                      <span className="rounded-full border border-border px-2 py-0.5">
                        Test mode — no real charge
                      </span>
                    )}
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

              {trip.status === "booked" && (
                <AddReservation
                  tripId={trip.id}
                  startDate={trip.startDate}
                  endDate={trip.endDate}
                />
              )}

              {trip.stops.length > 1 && (
                <div className="border-t border-border px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setMapFor(mapFor === trip.id ? null : trip.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary"
                  >
                    <MapPin className="size-4 text-primary" />
                    {mapFor === trip.id ? "Hide map" : "Show on map"}
                  </button>
                  {mapFor === trip.id && (
                    <div className="mt-4">
                      <TripRoute
                        stops={order[trip.id] ?? trip.stops}
                        onReorder={(next) =>
                          setOrder((prev) => ({ ...prev, [trip.id]: next }))
                        }
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Przesuń przystanki uchwytem lub strzałkami, żeby ułożyć trasę
                        logicznie. Zmiana kolejności tutaj nie zmienia już zrobionych
                        rezerwacji.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {trip.tips.length > 0 && (
                <div className="border-t border-border px-5 py-4">
                  <p className="text-sm font-medium">Good to know in {trip.city}</p>
                  <dl className="mt-3 space-y-3">
                    {trip.tips.map((tip) => (
                      <div key={tip.key}>
                        <dt className="text-xs font-medium text-muted-foreground">{tip.label}</dt>
                        <dd className="mt-0.5 text-sm">{tip.text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {(() => {
                const invoice = invoices.data?.find((row) => row.tripId === trip.id);
                if (!invoice) return null;
                return (
                  <div className="border-t border-border px-5 py-4">
                    <p className="text-sm font-medium">Invoice</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.documentNumber} · {invoice.issueDate}
                      {invoice.company ? ` · billed to ${invoice.company.name}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadInvoiceFor(invoice, "receipt", locale)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"
                      >
                        <FileText className="size-4" /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadInvoiceFor(invoice, "vat", locale)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <FileDown className="size-4" /> VAT invoice PDF
                      </button>
                      <Link
                        to="/invoices"
                        className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                      >
                        All invoices
                      </Link>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-border px-5 py-4">
                <Link
                  to="/support"
                  search={{ trip: trip.id, category: "other" }}
                  className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Something wrong with this trip?
                </Link>
              </div>

              {eventsFor(trip).length > 0 && (
                <div className="border-t border-border px-5 py-4">
                  <AddToCalendar events={eventsFor(trip)} title={trip.city ?? trip.title} />
                </div>
              )}

            </article>
          ))}
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
