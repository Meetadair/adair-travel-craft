import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { saveOnboarding } from "@/lib/account.functions";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const label = "block";
const labelText = "text-xs font-medium text-muted-foreground";

export function OnboardingPage() {
  const navigate = useNavigate();
  const save = useServerFn(saveOnboarding);
  const [step, setStep] = useState(0);

  const [fullName, setFullName] = useState("");
  const [homeAirport, setHomeAirport] = useState("WAW");
  const [seat, setSeat] = useState("window");
  const [cabinClass, setCabinClass] = useState("economy");
  const [maxConnections, setMaxConnections] = useState(1);
  const [hotelMinRating, setHotelMinRating] = useState(4);
  const [hotelRules, setHotelRules] = useState("");
  const [carTransmission, setCarTransmission] = useState("automatic");
  const [company, setCompany] = useState({ name: "", vatId: "", address: "", invoiceEmail: "" });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          fullName: fullName.trim() || "Traveller",
          homeAirport: homeAirport.trim().toUpperCase(),
          preferences: {
            seat: seat as "window" | "aisle" | "any",
            cabinClass: cabinClass as "economy" | "premium_economy" | "business" | "first",
            maxConnections,
            hotelMinRating,
            hotelRules: hotelRules.trim() || null,
            carTransmission: carTransmission as "automatic" | "manual" | "any",
          },
          company: company.name.trim()
            ? {
                name: company.name.trim(),
                vatId: company.vatId.trim() || null,
                address: company.address.trim() || null,
                invoiceEmail: company.invoiceEmail.trim() || null,
              }
            : null,
          complete: true,
        },
      }),
    onSuccess: () => navigate({ to: "/dashboard" }),
  });

  const steps = ["You", "Preferences", "Invoices"];

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Step {step + 1} of 3
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          {step === 0 && "Let's start with you"}
          {step === 1 && "How should we book?"}
          {step === 2 && "Invoices (optional)"}
        </h1>

        <div className="mt-6 flex gap-2">
          {steps.map((name, index) => (
            <span
              key={name}
              className={`h-1 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>

        <div className="hairline-card mt-8 space-y-4 p-6">
          {step === 0 && (
            <>
              <label className={label}>
                <span className={labelText}>Your name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  autoComplete="name"
                />
              </label>
              <label className={label}>
                <span className={labelText}>Home airport</span>
                <input
                  value={homeAirport}
                  onChange={(e) => setHomeAirport(e.target.value.toUpperCase().slice(0, 3))}
                  className={inputClass}
                  placeholder="WAW"
                />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <label className={label}>
                <span className={labelText}>Seat</span>
                <select
                  value={seat}
                  onChange={(e) => setSeat(e.target.value)}
                  className={inputClass}
                >
                  <option value="window">Window</option>
                  <option value="aisle">Aisle</option>
                  <option value="any">No preference</option>
                </select>
              </label>
              <label className={label}>
                <span className={labelText}>Cabin</span>
                <select
                  value={cabinClass}
                  onChange={(e) => setCabinClass(e.target.value)}
                  className={inputClass}
                >
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </select>
              </label>
              <label className={label}>
                <span className={labelText}>Maximum connections</span>
                <select
                  value={String(maxConnections)}
                  onChange={(e) => setMaxConnections(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="0">Direct only</option>
                  <option value="1">One connection</option>
                  <option value="2">Two connections</option>
                </select>
              </label>
              <label className={label}>
                <span className={labelText}>Minimum hotel rating</span>
                <select
                  value={String(hotelMinRating)}
                  onChange={(e) => setHotelMinRating(Number(e.target.value))}
                  className={inputClass}
                >
                  <option value="3">3 stars</option>
                  <option value="4">4 stars</option>
                  <option value="5">5 stars</option>
                </select>
              </label>
              <label className={label}>
                <span className={labelText}>Hotel rules, in your own words</span>
                <textarea
                  value={hotelRules}
                  onChange={(e) => setHotelRules(e.target.value)}
                  rows={3}
                  placeholder="No hotels without a lift. Quiet room away from the street."
                  className={inputClass}
                />
              </label>
              <label className={label}>
                <span className={labelText}>Car transmission</span>
                <select
                  value={carTransmission}
                  onChange={(e) => setCarTransmission(e.target.value)}
                  className={inputClass}
                >
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                  <option value="any">No preference</option>
                </select>
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Add a company if you need invoices in a company name. You can add more later.
              </p>
              <label className={label}>
                <span className={labelText}>Company name</span>
                <input
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                <span className={labelText}>VAT ID</span>
                <input
                  value={company.vatId}
                  onChange={(e) => setCompany({ ...company, vatId: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                <span className={labelText}>Address</span>
                <input
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className={label}>
                <span className={labelText}>Invoice email</span>
                <input
                  type="email"
                  value={company.invoiceEmail}
                  onChange={(e) => setCompany({ ...company, invoiceEmail: e.target.value })}
                  className={inputClass}
                />
              </label>
            </>
          )}

          {mutation.isError && (
            <p className="text-sm text-primary">
              We could not save that. Please check the fields and try again.
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4 disabled:opacity-40"
            >
              Back
            </button>
            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Check className="size-4" /> {mutation.isPending ? "Saving…" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
