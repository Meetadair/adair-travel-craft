/** Shared invoice PDF download, used by the invoices list and by each booking in My trips. */
import { downloadTripInvoice } from "@/lib/trip-pdf";
import type { InvoiceTrip } from "@/lib/invoices.functions";

export function downloadInvoiceFor(trip: InvoiceTrip, variant: "receipt" | "vat", locale: string) {
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
      company: trip.company
        ? [trip.company.name, trip.company.legalForm].filter(Boolean).join(" ")
        : "",
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
