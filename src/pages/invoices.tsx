/** Invoices: every booked trip, the company it is billed to, and PDF downloads. */
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileText, Building2 } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { listMyInvoices, type InvoiceTrip } from "@/lib/invoices.functions";
import { downloadTripInvoice } from "@/lib/trip-pdf";
import { useLocale } from "@/lib/i18n";
import { eur } from "@/lib/trip/client";

export function InvoicesPage() {
  const locale = useLocale();
  const fetchInvoices = useServerFn(listMyInvoices);
  const invoices = useQuery({ queryKey: ["my-invoices"], queryFn: () => fetchInvoices({}) });

  function download(trip: InvoiceTrip, variant: "receipt" | "vat") {
    void downloadTripInvoice({
      documentNumber: trip.documentNumber,
      issueDate: trip.issueDate,
      city: trip.city ?? "",
      origin: trip.origin ?? "",
      startDate: trip.startDate ?? "",
      endDate: trip.endDate ?? "",
      currency: trip.currency,
      live: !trip.testMode,
      locale,
      variant,
      buyer: {
        name: trip.buyer.name ?? "",
        company: trip.company ? [trip.company.name, trip.company.legalForm].filter(Boolean).join(" ") : "",
        taxId: trip.company?.vatId ?? "",
        email: trip.company?.invoiceEmails[0] ?? trip.buyer.email ?? "",
        addressLines: trip.company?.addressLines ?? [],
      },
      items: trip.items.map((item) => ({
        kind: item.kind,
        title: item.title,
        detail: item.detail ?? "",
        provider: "",
        offerReference: item.reference ?? "",
        amount: item.amount,
        currency: item.currency,
      })),
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Invoices</h1>
          <Link
            to="/preferences"
            className="text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Companies for invoicing
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Every trip, the company it is billed to, and its invoice documents.
        </p>

        {invoices.isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading…</p>}

        {invoices.data?.length === 0 && (
          <div className="hairline-card mt-10 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No invoices yet — they appear as soon as you book a trip.
            </p>
          </div>
        )}

        <div className="mt-10 space-y-6">
          {invoices.data?.map((trip) => (
            <article key={trip.tripId} className="hairline-card overflow-hidden">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">{trip.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {trip.documentNumber} · {trip.issueDate}
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

              <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Billed to
                  </p>
                  {trip.company ? (
                    <div className="mt-2 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <Building2 className="size-4 text-primary" />
                        {[trip.company.name, trip.company.legalForm].filter(Boolean).join(" ")}
                      </p>
                      {trip.company.addressLines.map((line) => (
                        <p key={line} className="text-muted-foreground">
                          {line}
                        </p>
                      ))}
                      {trip.company.vatId && (
                        <p className="text-muted-foreground">VAT ID {trip.company.vatId}</p>
                      )}
                      {trip.company.invoiceEmails.length > 0 && (
                        <p className="mt-1 text-muted-foreground">
                          {trip.company.invoiceEmails.join(", ")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No company chosen — add one on the preferences page and it will be used for
                      future invoices.
                    </p>
                  )}
                </div>

                <ul className="space-y-2 text-sm">
                  {trip.items.map((item, index) => (
                    <li key={`${trip.tripId}-${index}`} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate capitalize text-muted-foreground">
                        {item.kind} · {item.title}
                      </span>
                      <span>{eur(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={() => download(trip, "receipt")}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
                >
                  <FileText className="size-4" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => download(trip, "vat")}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <FileDown className="size-4" /> VAT invoice PDF
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
