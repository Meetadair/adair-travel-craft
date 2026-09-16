/** Edit everything answered during onboarding, any time. */
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { getMyReferral } from "@/lib/referrals.functions";
import { eur } from "@/lib/trip/client";
import {
  addCompany,
  deleteCompany,
  getAccount,
  saveBusinessPrefs,
  savePreferences,
  updateCompany,
  type BusinessPrefsPayload,
  type Company,
} from "@/lib/account.functions";
import { BUSINESS_OVERRIDE_FIELDS } from "@/lib/prefs/context";
import {
  EXTRA_ANSWER_FIELDS,
  QUESTIONS,
  answersToPrefs,
  part2Completion,
  prefsToAnswers,
  type Answers,
  type QuestionDef,
  type Toggles,
} from "@/lib/prefs/questions";
import { AirportPicker } from "@/components/prefs/airport-picker";
import { CompanyEditor } from "@/components/prefs/company-editor";
import { MultiField, SingleField, TextField, ToggleRow } from "@/components/prefs/option-chips";
import { cleanCompany, type CompanyDraft } from "@/lib/prefs/company-draft";
import { ConnectedCalendars } from "@/components/prefs/connected-calendars";
import { MyData } from "@/components/prefs/my-data";
import { Noticed } from "@/components/prefs/noticed";
import { Knows } from "@/components/prefs/knows";
import { PaymentCards } from "@/components/prefs/payment-cards";
import { TravellerProfiles } from "@/components/prefs/traveller-profiles";
import { WalletLoyalty } from "@/components/prefs/wallet-loyalty";
import { NotificationChannel } from "@/components/prefs/notification-channel";
import { AppFooter } from "@/components/app-footer";
import { BusinessTrips } from "@/components/prefs/business-trips";
import { Appearance } from "@/components/prefs/appearance";

const toDraft = (company: Company): CompanyDraft => ({
  name: company.name,
  legalForm: company.legalForm,
  country: company.country,
  city: company.city,
  postcode: company.postcode,
  street: company.street,
  building: company.building,
  addressExtra: company.addressExtra,
  vatId: company.vatId,
  invoiceEmails: company.invoiceEmails.length ? company.invoiceEmails : [""],
  isDefault: company.isDefault,
});

export function PreferencesPage() {
  const fetchAccount = useServerFn(getAccount);
  const persistPrefs = useServerFn(savePreferences);
  const persistWorkPrefs = useServerFn(saveBusinessPrefs);
  const createCompany = useServerFn(addCompany);
  const editCompany = useServerFn(updateCompany);
  const removeCompany = useServerFn(deleteCompany);
  const queryClient = useQueryClient();

  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });
  const fetchReferral = useServerFn(getMyReferral);
  const referral = useQuery({ queryKey: ["my-referral"], queryFn: () => fetchReferral({}) });

  const [fullName, setFullName] = useState("");
  const [homeAirport, setHomeAirport] = useState("WAW");
  const [answers, setAnswers] = useState<Answers>({});
  const [toggles, setToggles] = useState<Toggles>({});
  /**
   * The same questionnaire, answered twice. The work set starts as a copy of
   * the personal one, so nobody is made to fill anything in twice; only the
   * answers they actually change are stored as work overrides.
   */
  const [mode, setMode] = useState<"personal" | "work">("personal");
  const [workAnswers, setWorkAnswers] = useState<Answers>({});
  const [workToggles, setWorkToggles] = useState<Toggles>({});
  const [companies, setCompanies] = useState<CompanyDraft[]>([]);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (!account.data) return;
    const mapped = prefsToAnswers(account.data.preferences);
    setFullName(account.data.fullName ?? "");
    setHomeAirport(account.data.homeAirport);
    setAnswers(mapped.answers);
    setToggles(mapped.toggles);
    const work = prefsToAnswers({
      ...account.data.preferences,
      ...(account.data.businessPrefs as Partial<typeof account.data.preferences>),
    });
    setWorkAnswers(work.answers);
    setWorkToggles(work.toggles);
    setCompanies(account.data.companies.map(toDraft));
  }, [account.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      await persistPrefs({
        data: {
          fullName: fullName.trim() || null,
          homeAirport: homeAirport.toUpperCase(),
          preferences: answersToPrefs(answers, toggles),
        },
      });

      // Only what work actually answers differently is stored. A field left
      // alone falls through to the person, which is why the work tab does not
      // need filling in at all.
      const mine = answersToPrefs(answers, toggles) as Record<string, unknown>;
      const atWork = answersToPrefs(workAnswers, workToggles) as Record<string, unknown>;
      const overlay: Record<string, unknown> = {};
      for (const field of BUSINESS_OVERRIDE_FIELDS) {
        if (JSON.stringify(atWork[field]) !== JSON.stringify(mine[field])) {
          overlay[field] = atWork[field];
        }
      }
      await persistWorkPrefs({ data: { overlay: overlay as BusinessPrefsPayload } });

      const existing = account.data?.companies ?? [];
      for (const [index, draft] of companies.entries()) {
        const clean = cleanCompany(draft);
        if (!clean.name) continue;
        const match = existing[index];
        if (match) await editCompany({ data: { id: match.id, ...clean } });
        else await createCompany({ data: clean });
      }
      for (const stale of existing.slice(companies.length)) {
        await removeCompany({ data: { id: stale.id } });
      }
    },
    onSuccess: async () => {
      setSavedNote(true);
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      window.setTimeout(() => setSavedNote(false), 2500);
    },
  });

  const completion = part2Completion(answersToPrefs(answers, toggles), companies.length);

  // Which set of answers the questionnaire below is editing right now.
  const active = mode === "work" ? workAnswers : answers;
  const setActive = mode === "work" ? setWorkAnswers : setAnswers;
  const activeToggles = mode === "work" ? workToggles : toggles;
  const setActiveToggles = mode === "work" ? setWorkToggles : setToggles;
  const differsAtWork = (field: string) =>
    JSON.stringify(workAnswers[field] ?? []) !== JSON.stringify(answers[field] ?? []);

  // Some questions (food, interests, music, "anything else") are the
  // traveller, not the trip — see the note on BUSINESS_OVERRIDE_FIELDS. They
  // stay locked to the personal profile even on the work tab, so editing
  // them there can never look saved and then quietly not be.
  const overridableAtWork = new Set<string>([
    ...BUSINESS_OVERRIDE_FIELDS,
    ...EXTRA_ANSWER_FIELDS,
  ]);
  const isPersonOnly = (q: QuestionDef) => {
    const fields = [...(q.singles ?? []), ...(q.multis ?? []), ...(q.texts ?? [])].map(
      (d) => d.field,
    );
    return fields.length > 0 && fields.every((f) => !overridableAtWork.has(f));
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Travel preferences</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Adair uses these on every search — flights, hotels and cars.
        </p>

        {account.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}

        {account.data && (
          <div className="mt-8 space-y-6">
            <section className="hairline-card space-y-4 p-5 sm:p-6">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Your name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Home airport
                </p>
                <AirportPicker value={homeAirport} onChange={setHomeAirport} />
              </div>
            </section>

            <TravellerProfiles />

            <div className="hairline-card p-5 sm:p-6">
              <p className="text-sm font-medium">Which profile are you editing?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The same person travels twice over. A gym in Frankfurt and a pool in Crete are not
                the same preference, and shortest-door-to-door on a Tuesday is not how you want
                August to go. Answer once as yourself, then change only what business does
                differently — everything you leave alone stays the same on both.
              </p>
              <div className="mt-3 inline-flex rounded-xl border border-border p-1">
                {(
                  [
                    ["personal", "Private trips"],
                    ["work", "Business trips"],
                  ] as const
                ).map(([value, name]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      mode === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {mode === "work" && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Editing your business answers. Adair uses these when you say a trip is for work,
                  when the invoice goes to a company, or when the sentence reads like a meeting.
                </p>
              )}
            </div>

            {QUESTIONS.filter((q) => q.kind === "fields")
              .slice()
              .sort((a, b) => a.part - b.part)
              .map((q, index, list) => {
                const personOnly = isPersonOnly(q);
                const qActive = personOnly ? answers : active;
                const qSetActive = personOnly ? setAnswers : setActive;
                const qActiveToggles = personOnly ? toggles : activeToggles;
                const qSetActiveToggles = personOnly ? setToggles : setActiveToggles;
                return (
                <div key={q.id}>
                  {(index === 0 || list[index - 1]!.part !== q.part) && (
                    <div className="mb-2 mt-2" id={q.part === 2 ? "refine" : undefined}>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {q.part === 1
                          ? "Essentials & dealbreakers"
                          : "Refine your profile — makes every match better"}
                      </p>
                      {q.part === 2 && (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-1 w-40 overflow-hidden rounded-full bg-border">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {completion}% complete — optional
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <section className="hairline-card space-y-4 p-5 sm:p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-lg font-semibold">{q.title}</h2>
                      {mode === "personal" &&
                        [...(q.singles ?? []), ...(q.multis ?? [])].some((d) =>
                          differsAtWork(d.field),
                        ) && (
                          <button
                            type="button"
                            onClick={() => setMode("work")}
                            className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline"
                          >
                            different at work
                          </button>
                        )}
                    </div>
                    {q.hint && <p className="text-sm text-muted-foreground">{q.hint}</p>}
                    {mode === "work" && personOnly && (
                      <p className="text-xs text-muted-foreground">
                        Same whether it&apos;s work or personal — this is about you, not the trip.
                      </p>
                    )}
                    {q.singles?.map((def) => (
                      <SingleField
                        key={def.field}
                        def={def}
                        value={qActive[def.field] ?? []}
                        onChange={(next) => qSetActive((p) => ({ ...p, [def.field]: next }))}
                      />
                    ))}
                    {q.multis?.map((def) => (
                      <MultiField
                        key={def.field}
                        def={def}
                        value={qActive[def.field] ?? []}
                        onChange={(next) => qSetActive((p) => ({ ...p, [def.field]: next }))}
                        homeAirport={homeAirport}
                        fullList
                      />
                    ))}
                    {q.texts?.map((def) => (
                      <TextField
                        key={def.field}
                        def={def}
                        value={qActive[def.field]?.[0] ?? ""}
                        onChange={(next) =>
                          qSetActive((p) => ({ ...p, [def.field]: next.trim() ? [next] : [] }))
                        }
                      />
                    ))}
                    {q.toggles?.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.toggles.map((t) => (
                          <ToggleRow
                            key={t.field}
                            label={t.label}
                            checked={Boolean(qActiveToggles[t.field])}
                            onChange={(next) => qSetActiveToggles((p) => ({ ...p, [t.field]: next }))}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                </div>
                );
              })}

            <BusinessTrips />

            <ConnectedCalendars />

            <section className="hairline-card space-y-4 p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Companies for invoicing</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link
                  to="/invoices"
                  className="underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Invoices
                </Link>{" "}
                — every booked trip and its PDF documents.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link
                  to="/credit"
                  className="underline decoration-border underline-offset-4 hover:text-foreground"
                >
                  Credit &amp; referrals
                </Link>{" "}
                —{" "}
                {referral.data
                  ? `${eur(referral.data.balanceMinor / 100)} available`
                  : "invite friends and earn travel credit"}
                .
              </p>
              <CompanyEditor companies={companies} onChange={setCompanies} />
            </section>

            <Knows />

            <Noticed />

            <WalletLoyalty />
            <PaymentCards />
            <NotificationChannel />

            <Appearance />

            <MyData />

            <div className="sticky bottom-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
              >
                <Check className="size-4" /> {mutation.isPending ? "Saving…" : "Save preferences"}
              </button>
              {savedNote && <span className="text-sm text-muted-foreground">Saved.</span>}
              {mutation.isError && (
                <span className="text-sm text-primary">
                  We could not save that. Please try again.
                </span>
              )}
            </div>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
