/** Invoices tab: booked trips with the company they are billed to. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InvoiceCompany = {
  id: string;
  name: string;
  legalForm: string | null;
  vatId: string | null;
  addressLines: string[];
  invoiceEmails: string[];
};

export type InvoiceTrip = {
  tripId: string;
  documentNumber: string;
  issueDate: string;
  title: string;
  origin: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  totalEur: number;
  testMode: boolean;
  status: string;
  buyer: { name: string | null; email: string | null };
  company: InvoiceCompany | null;
  items: Array<{
    kind: string;
    title: string;
    detail: string | null;
    reference: string | null;
    amount: number;
    currency: string;
  }>;
};

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvoiceTrip[]> => {
    const { supabase, userId, claims } = context;

    const [tripsRes, companiesRes, profileRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, title, city, origin, start_date, end_date, status, total_amount, currency, document_number, data_source, company_id, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("companies")
        .select(
          "id, name, legal_form, vat_id, address, country, city, postcode, street, building, address_extra, invoice_email, invoice_emails, is_default",
        )
        .eq("user_id", userId),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    if (tripsRes.error) throw new Error(tripsRes.error.message);

    const trips = (tripsRes.data ?? []) as Array<Record<string, unknown>>;
    if (!trips.length) return [];

    const itemsRes = await supabase
      .from("trip_items")
      .select("trip_id, kind, title, detail, status, amount, currency, offer_reference, position")
      .eq("user_id", userId)
      .in(
        "trip_id",
        trips.map((t) => t["id"] as string),
      )
      .order("position", { ascending: true });
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const items = (itemsRes.data ?? []) as Array<Record<string, unknown>>;

    const toCompany = (row: Record<string, unknown>): InvoiceCompany => {
      const emails = asList(row["invoice_emails"]);
      const legacyEmail = (row["invoice_email"] as string | null) ?? null;
      const street = [row["street"], row["building"]].filter(Boolean).join(" ");
      const cityLine = [row["postcode"], row["city"]].filter(Boolean).join(" ");
      const lines = [
        street,
        cityLine,
        (row["country"] as string | null) ?? "",
        (row["address_extra"] as string | null) ?? "",
      ].filter((l) => String(l).trim().length);
      return {
        id: row["id"] as string,
        name: row["name"] as string,
        legalForm: (row["legal_form"] as string | null) ?? null,
        vatId: (row["vat_id"] as string | null) ?? null,
        addressLines: lines.length
          ? lines.map(String)
          : [((row["address"] as string | null) ?? "").trim()].filter((l) => l.length),
        invoiceEmails: emails.length ? emails : legacyEmail ? [legacyEmail] : [],
      };
    };

    const companies = ((companiesRes.data ?? []) as Array<Record<string, unknown>>).map(toCompany);
    const defaultCompany =
      ((companiesRes.data ?? []) as Array<Record<string, unknown>>).find((c) => c["is_default"]) ??
      null;
    const fullName = (profileRes.data as { full_name: string | null } | null)?.full_name ?? null;
    const email = (claims as { email?: string } | null)?.email ?? null;

    return trips.map((trip) => {
      const id = trip["id"] as string;
      const companyId = (trip["company_id"] as string | null) ?? null;
      const company =
        companies.find((c) => c.id === companyId) ??
        (defaultCompany ? toCompany(defaultCompany) : null);
      return {
        tripId: id,
        documentNumber:
          (trip["document_number"] as string | null) ?? `ADR/${id.slice(0, 6).toUpperCase()}`,
        issueDate: new Date(trip["created_at"] as string).toISOString().slice(0, 10),
        title: trip["title"] as string,
        origin: (trip["origin"] as string | null) ?? null,
        city: (trip["city"] as string | null) ?? null,
        startDate: (trip["start_date"] as string | null) ?? null,
        endDate: (trip["end_date"] as string | null) ?? null,
        currency: (trip["currency"] as string | null) ?? "EUR",
        totalEur: Number(trip["total_amount"] ?? 0),
        testMode: String(trip["data_source"] ?? "").includes("test"),
        status: trip["status"] as string,
        buyer: { name: fullName, email },
        company,
        items: items
          .filter((i) => i["trip_id"] === id)
          .map((i) => ({
            kind: i["kind"] as string,
            title: i["title"] as string,
            detail: (i["detail"] as string | null) ?? null,
            reference: (i["offer_reference"] as string | null) ?? null,
            amount: Number(i["amount"] ?? 0),
            currency: (i["currency"] as string | null) ?? "EUR",
          })),
      };
    });
  });
