import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plane, BedDouble, CarFront, Check, AlertTriangle } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getTripCard } from "@/lib/trip-live.functions";
import { bookTripCard, type BookingResult } from "@/lib/booking.functions";
import { getAccount } from "@/lib/account.functions";
import { eur } from "@/lib/trip/client";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

/** Plain-language explanation for each supplier failure. */
function failureMessage(reason: string | null): string {
  switch (reason) {
    case "offer-expired":
      return "The airline released this fare while you were confirming. Nothing was charged — search again to get a fresh price.";
    case "supplier-not-configured":
      return "Live booking is not switched on yet. Nothing was charged.";
    default:
      return "The airline could not complete this booking. Nothing was charged — please search again.";
  }
}


export function BookPage({ cardId }: { cardId: string }) {
  const navigate = useNavigate();
  const fetchCard = useServerFn(getTripCard);
  const fetchAccount = useServerFn(getAccount);
  const book = useServerFn(bookTripCard);

  const card = useQuery({
    queryKey: ["trip-card", cardId],
    queryFn: () => fetchCard({ data: { cardId } }),
  });
  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });

  const [include, setInclude] = useState({ flight: true, stay: true, car: true });
  const [companyId, setCompanyId] = useState<string>("");
  const [traveller, setTraveller] = useState({
    givenName: "",
    familyName: "",
    email: "",
    phone: "",
    bornOn: "",
    gender: "m",
    title: "mr",
  });
  const [result, setResult] = useState<BookingResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      book({
        data: {
          cardId,
          include,
          companyId: companyId || null,
          traveller: {
            ...traveller,
            gender: traveller.gender as "m" | "f",
            title: traveller.title as "mr" | "ms" | "mrs",
          },
        },
      }),
    onSuccess: (data) => setResult(data),
  });

  // Booked (fully or partly): show the confirmation, then move on to My trips.
  useEffect(() => {
    if (!result || result.status === "failed") return;
    const timer = window.setTimeout(() => navigate({ to: "/trips" }), 3500);
    return () => window.clearTimeout(timer);
  }, [result, navigate]);



  const search = card.data?.search;
  const priced = card.data?.priced;
  const selectedTotal =
    (include.flight ? (priced?.flight ?? 0) : 0) +
    (include.stay ? (priced?.stay ?? 0) : 0) +
    (include.car ? (priced?.car ?? 0) : 0);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Confirm your trip</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Test mode — no card is charged and no real ticket is issued.
        </p>

        {card.isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading…</p>}
        {card.isError && (
          <p className="mt-10 text-sm text-primary">We could not find this trip any more.</p>
        )}

        {card.data?.expired && !result && (
          <div className="hairline-card mt-8 flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 size-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              This price is no longer held. Search again to get a fresh price.
            </p>
          </div>
        )}

        {search && !result && (
          <>
            <div className="hairline-card mt-8 divide-y divide-border">
              {search.flight && (
                <Line
                  icon={<Plane className="size-4" />}
                  title={`${search.flight.carrier} ${search.flight.flightNumbers.join(" / ")}`}
                  detail={`${search.request.originCity} → ${search.request.destinationCity}`}
                  amount={priced?.flight ?? 0}
                  checked={include.flight}
                  onToggle={() => setInclude((s) => ({ ...s, flight: !s.flight }))}
                />
              )}
              {search.stay && (
                <Line
                  icon={<BedDouble className="size-4" />}
                  title={search.stay.name}
                  detail={search.stay.address}
                  amount={priced?.stay ?? 0}
                  checked={include.stay}
                  onToggle={() => setInclude((s) => ({ ...s, stay: !s.stay }))}
                />
              )}
              {search.car && (
                <Line
                  icon={<CarFront className="size-4" />}
                  title={`${search.car.vehicle} · ${search.car.supplier}`}
                  detail={search.car.transmission}
                  amount={priced?.car ?? 0}
                  checked={include.car}
                  onToggle={() => setInclude((s) => ({ ...s, car: !s.car }))}
                />
              )}
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-display text-xl font-semibold text-primary">
                  {eur(selectedTotal)}
                </span>
              </div>
            </div>

            <div className="hairline-card mt-6 space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Traveller</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">First name</span>
                  <input
                    className={inputClass}
                    value={traveller.givenName}
                    onChange={(e) => setTraveller({ ...traveller, givenName: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Last name</span>
                  <input
                    className={inputClass}
                    value={traveller.familyName}
                    onChange={(e) => setTraveller({ ...traveller, familyName: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Email</span>
                  <input
                    type="email"
                    className={inputClass}
                    value={traveller.email}
                    onChange={(e) => setTraveller({ ...traveller, email: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Phone</span>
                  <input
                    className={inputClass}
                    placeholder="+48600000000"
                    value={traveller.phone}
                    onChange={(e) => setTraveller({ ...traveller, phone: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Date of birth</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={traveller.bornOn}
                    onChange={(e) => setTraveller({ ...traveller, bornOn: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Title</span>
                  <select
                    className={inputClass}
                    value={traveller.title}
                    onChange={(e) =>
                      setTraveller({
                        ...traveller,
                        title: e.target.value,
                        gender: e.target.value === "mr" ? "m" : "f",
                      })
                    }
                  >
                    <option value="mr">Mr</option>
                    <option value="ms">Ms</option>
                    <option value="mrs">Mrs</option>
                  </select>
                </label>
              </div>

              {account.data?.companies.length ? (
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Invoice to</span>
                  <select
                    className={inputClass}
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">Myself</option>
                    {account.data.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mutation.isError && (
                <p className="text-sm text-primary">
                  The booking did not go through. Nothing was charged — please try again.
                </p>
              )}

              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || card.data?.expired}
                className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {mutation.isPending ? "Booking…" : `Book it all · ${eur(selectedTotal)}`}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="hairline-card mt-8 p-6">
            <div className="flex items-center gap-2">
              {result.status === "failed" ? (
                <AlertTriangle className="size-5 text-primary" />
              ) : (
                <Check className="size-5 text-primary" />
              )}
              <h2 className="font-display text-xl font-semibold">
                {result.status === "confirmed" && "Booked"}
                {result.status === "partial" && "Partly booked"}
                {result.status === "failed" && "Nothing was booked"}
              </h2>
            </div>
            {result.reference && (
              <p className="mt-2 text-sm text-muted-foreground">
                Booking reference {result.reference}
              </p>
            )}
            {result.repriced && (
              <p className="mt-2 text-sm text-muted-foreground">
                The airline price changed from {eur(result.repriced.from)} to{" "}
                {eur(result.repriced.to)} before we booked.
              </p>
            )}
            <ul className="mt-5 space-y-3">
              {result.lines.map((line) => (
                <li key={`${line.kind}-${line.title}`} className="flex justify-between text-sm">
                  <span>
                    {line.title}
                    <span className="ml-2 text-xs text-muted-foreground">{line.status}</span>
                  </span>
                  <span>{eur(line.amountEur)}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate({ to: "/trips" })}
              className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to my trips
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Line({
  icon,
  title,
  detail,
  amount,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string | null;
  amount: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <input type="checkbox" checked={checked} onChange={onToggle} className="accent-primary" />
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
      <span className="text-sm">{eur(amount)}</span>
    </div>
  );
}
