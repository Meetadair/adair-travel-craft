import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plane, BedDouble, CarFront, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { INSURANCE_DETAIL, INSURANCE_TITLE } from "@/lib/trip/insurance";
import { SiteNav } from "@/components/site-nav";
import { AddToCalendar } from "@/components/add-to-calendar";
import { TripExtras } from "@/components/trip-extras";
import type { RideLeg } from "@/lib/suppliers/types";

import { getTripCard } from "@/lib/trip-live.functions";
import { bookTripCard, type BookingResult } from "@/lib/booking.functions";
import { getAccount } from "@/lib/account.functions";
import { listCompanions } from "@/lib/companions.functions";
import { getFlightAncillaries } from "@/lib/ancillaries.functions";
import { FlightExtras } from "@/components/flight-extras";
import { ancillariesTotalEur, type AncillarySelection } from "@/lib/trip/ancillaries";
import { getPaymentSession } from "@/lib/payment.functions";
import { PaymentStep, type AuthorisedPayment } from "@/components/payment-step";
import { eur } from "@/lib/trip/client";
import { isSchengen } from "@/lib/trip/backwards";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

/** Plain-language explanation for each supplier failure. */
function failureMessage(reason: string | null): string {
  switch (reason) {
    case "offer-expired":
      return "The airline released this fare while you were confirming. Your card was not charged — search again to get a fresh price.";
    case "supplier-not-configured":
      return "Live booking is not switched on yet. Nothing was charged.";
    case "card-declined":
      return "Your card was declined, so nothing was charged. Try another card or ask your bank.";
    case "already-booked":
      return "This trip is already paid for — we did not charge you again. You will find it in My trips.";
    default:
      return "The airline could not complete this booking. Your card was not charged — please search again.";
  }
}

/** Turns a thrown booking error into one of the reasons above. */
function reasonFromError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("already-booked")) return "already-booked";
  if (message.includes("offer")) return "offer-expired";
  if (message.includes("card")) return "card-declined";
  return null;
}

/** How the traveller paid, for the receipt. */
function methodLabel(payment: BookingResult["payment"]): string {
  if (!payment) return "Test-mode payment";
  if (payment.method === "balance") return "Test-mode payment";
  const brand = payment.brand ? payment.brand.replace(/_/g, " ") : "Card";
  return payment.last4 ? `${brand} ···· ${payment.last4}` : brand;
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

  const [include, setInclude] = useState({
    flight: true,
    stay: true,
    car: true,
    insurance: false,
  });
  // Airport transfers the traveller opted into, by leg.
  const [rides, setRides] = useState<RideLeg[]>([]);
  const toggleRide = (leg: RideLeg) =>
    setRides((current) =>
      current.includes(leg) ? current.filter((l) => l !== leg) : [...current, leg],
    );
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
  /** One entry per extra seat; passenger 1 is the lead traveller above. */
  const [companions, setCompanions] = useState<
    Array<{
      givenName: string;
      familyName: string;
      bornOn: string;
      gender: string;
      title: string;
      passportNumber: string;
      remember: boolean;
    }>
  >([]);
  const [extras, setExtras] = useState<AncillarySelection[]>([]);
  const [extrasTouched, setExtrasTouched] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  /** "review" = traveller + invoice details, "pay" = card entry. */
  const [step, setStep] = useState<"review" | "pay">("review");

  const fetchPayment = useServerFn(getPaymentSession);
  const payment = useQuery({
    queryKey: ["payment-session", cardId],
    queryFn: () => fetchPayment({ data: { cardId } }),
    enabled: step === "pay",
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (authorised: AuthorisedPayment | null) =>
      book({
        data: {
          cardId,
          include: { ...include, rides },
          companyId: companyId || null,
          traveller: {
            ...traveller,
            gender: traveller.gender as "m" | "f",
            title: traveller.title as "mr" | "ms" | "mrs",
          },
          companions: companions.map((c) => ({
            givenName: c.givenName,
            familyName: c.familyName,
            bornOn: c.bornOn,
            gender: c.gender as "m" | "f",
            title: c.title as "mr" | "ms" | "mrs",
            passportNumber: c.passportNumber.trim() || null,
            remember: c.remember,
          })),
          ancillaries: include.flight ? extras : [],
          payment: authorised,
        },
      }),
    onSuccess: (data) => setResult(data),
  });

  const updateCompanion = (
    index: number,
    patch: Partial<(typeof companions)[number]>,
  ) =>
    setCompanions((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  /** Passports are only asked for on routes that leave the Schengen area. */
  const destinationIata = card.data?.search?.request.destinationIata;
  const passportNeeded = !!destinationIata && !isSchengen(destinationIata);

  const travellerReady =
    traveller.givenName.trim().length > 0 &&
    traveller.familyName.trim().length > 0 &&
    /.+@.+\..+/.test(traveller.email) &&
    traveller.phone.trim().length >= 6 &&
    /^\d{4}-\d{2}-\d{2}$/.test(traveller.bornOn) &&
    companions.every(
      (c) =>
        c.givenName.trim().length > 0 &&
        c.familyName.trim().length > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(c.bornOn),
    );

  // Booked (fully or partly): show the confirmation, then move on to My trips.
  useEffect(() => {
    if (!result || result.status === "failed") return;
    const timer = window.setTimeout(() => navigate({ to: "/trips" }), 3500);
    return () => window.clearTimeout(timer);
  }, [result, navigate]);



  const search = card.data?.search;
  const paxCount = Math.max(1, search?.request.passengers ?? 1);
  const fetchCompanions = useServerFn(listCompanions);
  const fetchExtras = useServerFn(getFlightAncillaries);
  const flightExtras = useQuery({
    queryKey: ["flight-extras", cardId],
    queryFn: () => fetchExtras({ data: { cardId } }),
    enabled: include.flight,
    staleTime: 10 * 60 * 1000,
  });

  // Pre-tick the airline's extras from the stored preferences, once.
  useEffect(() => {
    if (extrasTouched || !flightExtras.data) return;
    setExtras(flightExtras.data.preselected);
  }, [flightExtras.data, extrasTouched]);

  const extrasTotal = flightExtras.data
    ? ancillariesTotalEur(flightExtras.data.options, extras)
    : 0;
  const saved = useQuery({ queryKey: ["companions"], queryFn: () => fetchCompanions({}) });

  // Match the number of forms to the seats booked, pre-filling saved people.
  useEffect(() => {
    setCompanions((current) => {
      const wanted = paxCount - 1;
      if (current.length === wanted) return current;
      const next = current.slice(0, wanted);
      while (next.length < wanted) {
        const suggestion = saved.data?.[next.length];
        next.push({
          givenName: suggestion?.givenName ?? "",
          familyName: suggestion?.familyName ?? "",
          bornOn: suggestion?.bornOn ?? "",
          gender: "f",
          title: "ms",
          passportNumber: "",
          remember: !suggestion,
        });
      }
      return next;
    });
  }, [paxCount, saved.data]);
  const priced = card.data?.priced;
  const insurance = card.data?.insurance ?? null;
  const selectedTotal =
    Math.round(
      ((include.flight ? (priced?.flight ?? 0) : 0) +
        (include.stay ? (priced?.stay ?? 0) : 0) +
        (include.car ? (priced?.car ?? 0) : 0) +
        (include.insurance && insurance ? insurance.grossEur : 0) +
        (include.flight ? extrasTotal : 0)) *
        100,
    ) / 100;

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
              {insurance && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={include.insurance}
                      onChange={() =>
                        setInclude((s) => ({ ...s, insurance: !s.insurance }))
                      }
                      className="accent-primary"
                      aria-label="Add travel insurance"
                    />
                    <span className="text-muted-foreground">
                      <ShieldCheck className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {INSURANCE_TITLE}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Insurance · {insurance.nights} night
                        {insurance.nights === 1 ? "" : "s"} · {insurance.passengers} traveller
                        {insurance.passengers === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-sm">{eur(insurance.grossEur)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {INSURANCE_DETAIL}
                  </p>
                </div>
              )}
              <TripExtras cardId={cardId} rides={rides} onToggleRide={toggleRide} />
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-display text-xl font-semibold text-primary">
                  {eur(selectedTotal)}
                </span>
              </div>
            </div>

            <div className="hairline-card mt-6 space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">
                {paxCount === 1 ? "Traveller" : `Travellers · ${paxCount}`}
              </h2>
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


              {companions.map((person, index) => (
                <div key={index} className="space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    {`Traveller ${index + 2} of ${paxCount}`}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">First name</span>
                      <input
                        className={inputClass}
                        value={person.givenName}
                        onChange={(e) => updateCompanion(index, { givenName: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Last name</span>
                      <input
                        className={inputClass}
                        value={person.familyName}
                        onChange={(e) => updateCompanion(index, { familyName: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Date of birth
                      </span>
                      <input
                        type="date"
                        className={inputClass}
                        value={person.bornOn}
                        onChange={(e) => updateCompanion(index, { bornOn: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Title</span>
                      <select
                        className={inputClass}
                        value={person.title}
                        onChange={(e) =>
                          updateCompanion(index, {
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
                    {passportNeeded && (
                      <label className="block sm:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Passport number
                        </span>
                        <input
                          className={inputClass}
                          value={person.passportNumber}
                          onChange={(e) =>
                            updateCompanion(index, { passportNumber: e.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={person.remember}
                      onChange={(e) => updateCompanion(index, { remember: e.target.checked })}
                    />
                    Save to the people I travel with
                  </label>
                </div>
              ))}

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
                  {failureMessage(reasonFromError(mutation.error))}
                </p>
              )}

              {step === "review" && (
                <button
                  onClick={() => setStep("pay")}
                  disabled={!travellerReady || card.data?.expired}
                  className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {`Continue to payment · ${eur(selectedTotal)}`}
                </button>
              )}
              {step === "review" && !travellerReady && (
                <p className="text-center text-xs text-muted-foreground">
                  Fill in the traveller details to continue.
                </p>
              )}
            </div>

            {include.flight && flightExtras.data && (
              <FlightExtras
                data={flightExtras.data}
                selection={extras}
                onChange={(next) => {
                  setExtrasTouched(true);
                  setExtras(next);
                }}
              />
            )}

            {step === "pay" && (
              <div className="hairline-card mt-6 space-y-4 p-6">
                {payment.isLoading && (
                  <p className="text-sm text-muted-foreground">Opening the secure card form…</p>
                )}
                {payment.data && (
                  <PaymentStep
                    session={payment.data}
                    amountEur={selectedTotal}
                    disabled={mutation.isPending || card.data?.expired === true}
                    payingLabel={mutation.isPending ? "Payment approved — booking your trip…" : null}
                    onAuthorised={(authorised) => mutation.mutate(authorised)}
                  />
                )}
                <button
                  onClick={() => setStep("review")}
                  className="w-full text-center text-xs text-muted-foreground underline"
                >
                  Back to traveller details
                </button>
              </div>
            )}
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
            {result.testMode && (
              <span className="mt-3 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                Test mode — no real charge
              </span>
            )}
            {result.status === "failed" && (
              <p className="mt-3 text-sm text-muted-foreground">{failureMessage(result.reason)}</p>
            )}
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

            {result.status !== "failed" && (
              <div className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charged</span>
                  <span className="font-semibold">{eur(result.payment?.amountEur ?? result.totalEur)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid with</span>
                  <span className="capitalize">{methodLabel(result.payment)}</span>
                </div>
                {result.status === "partial" && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    One part of this trip could not be confirmed, so you were only charged for what
                    was booked.
                  </p>
                )}
                <button
                  onClick={() => navigate({ to: "/invoices" })}
                  className="pt-2 text-xs text-primary underline"
                >
                  View the invoice
                </button>
              </div>
            )}

            {(result.loyalty?.applied.length || result.loyalty?.notApplied.length) && (
              <div className="mt-5 border-t border-border pt-4 text-sm">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Loyalty numbers
                </p>
                <ul className="mt-2 space-y-1">
                  {result.loyalty.applied.map((m) => (
                    <li key={`${m.programme}-${m.masked}`} className="text-muted-foreground">
                      <span className="text-foreground">{m.programme}</span> {m.masked}
                      {m.tier ? ` · ${m.tier}` : ""} — {m.where}
                    </li>
                  ))}
                  {result.loyalty.notApplied.map((m) => (
                    <li key={`${m.programme}-${m.masked}-x`} className="text-muted-foreground">
                      <span className="text-foreground">{m.programme}</span> {m.masked} — not
                      applied: {m.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}



            {result.calendar.length > 0 && (
              <AddToCalendar
                events={result.calendar}
                title={card.data?.search?.request.destinationCity ?? "Adair trip"}
                className="mt-5"
              />
            )}

            {result.status === "failed" ? (
              <button
                onClick={() => navigate({ to: "/" })}
                className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Search again
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate({ to: "/trips" })}
                  className="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Go to my trips
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Taking you to My trips…
                </p>
              </>
            )}
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
