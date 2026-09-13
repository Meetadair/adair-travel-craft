/**
 * Closing the booking in the conversation.
 *
 * Adair asks only what it does not already know, confirms the extras from the
 * sentence in one line, then offers a single summary line and one button.
 * Passport routes and payment recovery still finish on the /book page.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  buildClosing,
  nothingToAsk,
  savedCardLabel,
  summaryLine,
  type ClosingExtra,
} from "@/lib/trip/closing";
import { getAccount } from "@/lib/account.functions";
import {
  getBookingIdentity,
  saveBookingIdentity,
  saveInvoiceCompany,
} from "@/lib/identity.functions";
import { getPaymentSession } from "@/lib/payment.functions";
import { PaymentStep, type AuthorisedPayment } from "@/components/payment-step";
import { bookTripCard, type BookingResult } from "@/lib/booking.functions";
import { track } from "@/lib/track";
import { useT } from "@/lib/i18n";

const fieldClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const chipClass =
  "rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-primary";

export function ClosingChat({
  cardId,
  summaryParts,
  totalLabel,
  totalEur,
  include,
  rides,
  extras,
  invoiceMentioned,
  passportRequired,
  ancillaries,
}: {
  cardId: string;
  /** "Milan", "Thu–Fri", "LOT 6:55", "Park Hyatt" … */
  summaryParts: string[];
  totalLabel: string;
  /** Trip total in euros, for the card form's own label. */
  totalEur: number;
  include: { flight: boolean; stay: boolean; car: boolean; insurance?: boolean };
  rides: Array<"arrival" | "departure">;
  extras: ClosingExtra[];
  invoiceMentioned: boolean;
  passportRequired: boolean;
  ancillaries?: Array<{ serviceId: string; quantity: number }>;
}) {
  const navigate = useNavigate();
  const c = useT().assistant.closing;
  const fetchAccount = useServerFn(getAccount);
  const fetchIdentity = useServerFn(getBookingIdentity);
  const fetchPayment = useServerFn(getPaymentSession);
  const persistIdentity = useServerFn(saveBookingIdentity);
  const persistCompany = useServerFn(saveInvoiceCompany);
  const book = useServerFn(bookTripCard);

  const account = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount({}) });
  const identity = useQuery({
    queryKey: ["booking-identity"],
    queryFn: () => fetchIdentity({}),
  });
  const payment = useQuery({
    queryKey: ["payment-session", cardId],
    queryFn: () => fetchPayment({ data: { cardId } }),
    staleTime: 10 * 60 * 1000,
  });

  const [companyChoice, setCompanyChoice] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [cardChoice, setCardChoice] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [details, setDetails] = useState({
    givenName: "",
    familyName: "",
    email: "",
    phone: "",
    bornOn: "",
  });
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [payNow, setPayNow] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const companies = account.data?.companies ?? [];
  const cards = payment.data?.savedCards ?? [];
  const keptExtras = extras.filter((extra) => !dropped.includes(extra.id));

  const closing = useMemo(
    () =>
      buildClosing({
        companies: companies.map((company) => ({
          id: company.id,
          name: company.name,
          isDefault: company.isDefault,
        })),
        cards: cards.map((card) => ({
          id: card.id,
          brand: card.brand,
          last4: card.last4,
          isDefault: card.isDefault,
        })),
        invoiceMentioned,
        extras: keptExtras,
        passportRequired,
        travellerComplete: (identity.data?.complete ?? false) || detailsSaved,
      }),
    [
      companies,
      cards,
      invoiceMentioned,
      keptExtras,
      passportRequired,
      identity.data?.complete,
      detailsSaved,
    ],
  );

  const loading = account.isLoading || identity.isLoading || payment.isLoading;

  // Passport capture stays on the booking page — it is a document, not a chat.
  if (closing.fallback === "passport") {
    return (
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-muted-foreground">
          {c.passport}
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: "/book/$cardId", params: { cardId } })}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {c.continueSecure}
        </button>
      </div>
    );
  }

  const chosenCompanyId =
    companyChoice === "none" ? null : (companyChoice ?? closing.companyId);
  const chosenCompanyName =
    companies.find((company) => company.id === chosenCompanyId)?.name ?? null;
  const chosenCardId = cardChoice === "new" ? null : (cardChoice ?? closing.cardId);
  const chosenCard = cards.find((card) => card.id === chosenCardId) ?? null;
  const needsCompanyName =
    closing.questions.some((q) => q.kind === "invoice_company_name") && !chosenCompanyName;
  const needsDetails = closing.questions.some((q) => q.kind === "traveller_details");
  const needsCardChoice =
    closing.questions.some((q) => q.kind === "card_choose") && cardChoice === null;

  const mutation = useMutation({
    mutationFn: (authorised: AuthorisedPayment | null) =>
      book({
        data: {
          cardId,
          include: { ...include, insurance: include.insurance ?? false, rides },
          companyId: chosenCompanyId,
          traveller: {
            givenName: details.givenName || identity.data?.givenName || "",
            familyName: details.familyName || identity.data?.familyName || "",
            email: details.email || identity.data?.email || "",
            phone: details.phone || identity.data?.phone || "",
            bornOn: details.bornOn || identity.data?.bornOn || "",
            gender: identity.data?.gender ?? "m",
            title: identity.data?.title ?? "mr",
          },
          companions: [],
          ancillaries: ancillaries ?? [],
          payment: authorised,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.status !== "failed") {
        track("closing_booked_in_chat", { cardId });
        window.setTimeout(() => navigate({ to: "/trips" }), 2500);
      }
    },
    onError: () =>
      setProblem(c.failed),
  });

  if (loading) {
    return <p className="mt-4 text-sm text-muted-foreground">{c.moment}</p>;
  }

  if (result && result.status !== "failed") {
    return (
      <p className="mt-4 text-sm font-medium text-primary">
        {c.booked}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4 text-sm">
      {/* extras from the sentence: confirmed, not asked */}
      {closing.extrasLine && (
        <div className="flex flex-wrap items-center gap-2">
          <span>{closing.extrasLine}</span>
          {keptExtras.map((extra) => (
            <button
              key={extra.id}
              type="button"
              onClick={() => setDropped((current) => [...current, extra.id])}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary"
            >
              <X className="size-3" /> {extra.label}
            </button>
          ))}
        </div>
      )}

      {/* invoice: only when we do not already know */}
      {closing.questions
        .filter((q) => q.kind === "invoice_choose")
        .map((question) => (
          <div key={question.kind} className="space-y-2">
            <p>{question.question}</p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCompanyChoice(option.value)}
                  className={`${chipClass} ${
                    companyChoice === option.value ? "border-primary text-primary" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}

      {needsCompanyName && (
        <div className="space-y-2">
          <p>{c.invoiceName}</p>
          <div className="flex gap-2">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder={c.companyPlaceholder}
              className={`${fieldClass} mt-0`}
              aria-label={c.companyPlaceholder}
            />
            <button
              type="button"
              disabled={companyName.trim().length < 2}
              onClick={() => {
                void persistCompany({ data: { name: companyName.trim() } })
                  .then((saved) => {
                    setCompanyChoice(saved.id);
                    void account.refetch();
                  })
                  .catch(() => setProblem(c.companyFailed));
              }}
              className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary disabled:opacity-60"
            >
              {c.save}
            </button>
          </div>
        </div>
      )}

      {/* ticket details: asked once, remembered afterwards */}
      {needsDetails && (
        <div className="space-y-2">
          <p>{c.detailsOnce}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={details.givenName}
              onChange={(event) => setDetails((d) => ({ ...d, givenName: event.target.value }))}
              placeholder={c.firstName}
              aria-label={c.firstName}
              className={fieldClass}
            />
            <input
              value={details.familyName}
              onChange={(event) => setDetails((d) => ({ ...d, familyName: event.target.value }))}
              placeholder={c.lastName}
              aria-label={c.lastName}
              className={fieldClass}
            />
            <input
              value={details.email}
              onChange={(event) => setDetails((d) => ({ ...d, email: event.target.value }))}
              placeholder={c.email}
              aria-label={c.email}
              className={fieldClass}
            />
            <input
              value={details.phone}
              onChange={(event) => setDetails((d) => ({ ...d, phone: event.target.value }))}
              placeholder={c.phone}
              aria-label={c.phone}
              className={fieldClass}
            />
            <input
              type="date"
              value={details.bornOn}
              onChange={(event) => setDetails((d) => ({ ...d, bornOn: event.target.value }))}
              aria-label={c.bornOn}
              className={fieldClass}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              void persistIdentity({
                data: {
                  ...details,
                  gender: identity.data?.gender ?? "m",
                  title: identity.data?.title ?? "mr",
                },
              })
                .then(() => {
                  setDetailsSaved(true);
                  void identity.refetch();
                })
                .catch(() => setProblem(c.detailsFailed));
            }}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
          >
            {c.saveForNextTime}
          </button>
        </div>
      )}

      {/* payment: which card, when there is a choice */}
      {closing.questions
        .filter((q) => q.kind === "card_choose")
        .map((question) => (
          <div key={question.kind} className="space-y-2">
            <p>{question.question}</p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCardChoice(option.value)}
                  className={`${chipClass} ${
                    cardChoice === option.value ? "border-primary text-primary" : ""
                  } capitalize`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}

      {/* the one summary line and the one action */}
      <p className="font-medium">
        {summaryLine({
          parts: [...summaryParts, ...keptExtras.map((extra) => extra.label)],
          companyName: chosenCompanyName,
          cardLabel: chosenCard ? savedCardLabel(chosenCard) : null,
          totalLabel,
        })}
      </p>

      {problem && (
        <div className="space-y-2">
          <p className="text-primary">{problem}</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/book/$cardId", params: { cardId } })}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
          >
            {c.finishSecure}
          </button>
        </div>
      )}

      {!payNow ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={needsDetails || needsCardChoice}
            onClick={() => {
              setPayNow(true);
              track("closing_confirmed", { cardId, questions: closing.questions.length });
            }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {c.bookIt}
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/book/$cardId", params: { cardId } })}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-primary"
          >
            {c.changeSomething}
          </button>
        </div>
      ) : payment.data ? (
        <div data-testid="inline-card-form">
          <PaymentStep
            session={payment.data}
            amountEur={totalEur}
            preselectCardId={chosenCardId ?? undefined}
            disabled={mutation.isPending}
            payingLabel={mutation.isPending ? "Booking…" : null}
            onAuthorised={(authorised) => mutation.mutate(authorised)}
          />
        </div>
      ) : (
        <p className="text-muted-foreground">{c.opening}</p>
      )}

      {nothingToAsk(closing) && !payNow && (
        <p className="text-xs text-muted-foreground">
          {c.testMode}
        </p>
      )}
    </div>
  );
}
