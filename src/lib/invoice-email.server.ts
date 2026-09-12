/**
 * Sends the trip invoice to the company's invoice addresses after booking.
 * Silently does nothing when RESEND_API_KEY is not configured.
 */

export type InvoiceEmailLine = {
  kind: string;
  title: string;
  detail: string | null;
  reference: string | null;
  amountEur: number;
};

export type InvoiceEmailInput = {
  to: string[];
  documentNumber: string;
  companyName: string | null;
  companyVatId: string | null;
  companyAddress: string[];
  origin: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  totalEur: number;
  testMode: boolean;
  /** Set when this invoice corrects an earlier one after a trip change. */
  correctionOf?: string | null;
  lines: InvoiceEmailLine[];
};

const VAT_RATE = 0.23;
const money = (value: number) => `${value.toFixed(2)} EUR`;

const LABEL: Record<string, string> = {
  flight: "Flight",
  stay: "Hotel",
  hotel: "Hotel",
  car: "Car",
  insurance: "Travel insurance",
};

export async function sendInvoiceEmail(
  input: InvoiceEmailInput,
): Promise<{ sent: boolean; skipped?: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { sent: false, skipped: "no-email-key" };
  const recipients = input.to.filter((e) => /.+@.+\..+/.test(e));
  if (!recipients.length) return { sent: false, skipped: "no-recipient" };

  const gross = input.totalEur;
  const net = gross / (1 + VAT_RATE);
  const vat = gross - net;

  const rows = input.lines
    .map(
      (line) => `<tr>
        <td style="padding:6px 0;">${LABEL[line.kind] ?? line.kind}: ${line.title}${
          line.reference ? ` <span style="color:#8f8b85">(${line.reference})</span>` : ""
        }${line.detail ? `<br><span style="color:#8f8b85">${line.detail}</span>` : ""}</td>
        <td style="padding:6px 0;text-align:right;">${money(line.amountEur)}</td>
      </tr>`,
    )
    .join("");

  const route = [input.origin, input.destination].filter(Boolean).join(" → ");
  const dates = [input.startDate, input.endDate].filter(Boolean).join(" – ");

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#2e2921;max-width:560px">
    <p style="font-size:20px;font-weight:600;margin:0 0 4px">Adair.</p>
    <p style="margin:0 0 16px;color:#8f8b85">${
      input.correctionOf ? "Corrected VAT invoice" : "VAT invoice"
    } ${input.documentNumber}${
      input.correctionOf ? ` · replaces ${input.correctionOf}` : ""
    }${input.testMode ? " · Test mode — no real charge" : ""}</p>
    <p style="margin:0 0 4px"><strong>${input.companyName ?? ""}</strong></p>
    <p style="margin:0 0 16px;color:#6b665e">${input.companyAddress.join(", ")}${
      input.companyVatId ? `<br>VAT ID ${input.companyVatId}` : ""
    }</p>
    <p style="margin:0 0 12px">${route}${dates ? ` · ${dates}` : ""}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    <hr style="border:none;border-top:1px solid #e0dcd4;margin:16px 0">
    <p style="margin:0">Net ${money(net)}</p>
    <p style="margin:0">VAT 23% ${money(vat)}</p>
    <p style="margin:8px 0 0;font-weight:600">Total ${money(gross)}</p>
    <p style="margin:24px 0 0;color:#8f8b85;font-size:12px">Adair Travel · One request. The whole trip.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env["RESEND_FROM"] ?? "Adair <onboarding@resend.dev>",
      to: recipients,
      subject: `${input.correctionOf ? "Corrected invoice" : "Invoice"} ${input.documentNumber} · ${route || "Adair trip"}`,
      html,
    }),
  });
  if (!res.ok) return { sent: false, skipped: `resend-${res.status}` };
  return { sent: true };
}
