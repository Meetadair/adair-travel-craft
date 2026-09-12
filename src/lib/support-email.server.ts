/**
 * Notifies the support inbox about a new help request.
 * Does nothing when RESEND_API_KEY or SUPPORT_EMAIL is not configured — the
 * request is still stored either way.
 */

export type SupportNotification = {
  id: string;
  category: string;
  urgency: string;
  description: string;
  tripReference: string | null;
  tripTitle: string | null;
  contactEmail: string | null;
};

export async function notifySupport(
  input: SupportNotification,
): Promise<{ sent: boolean; skipped?: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { sent: false, skipped: "no-email-key" };
  const to = process.env["SUPPORT_EMAIL"] ?? process.env["INVOICE_FROM_EMAIL"];
  if (!to) return { sent: false, skipped: "no-support-address" };

  const subject = `Help request · ${input.category}${
    input.tripReference ? ` · ${input.tripReference}` : ""
  }`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1c1917;">
      <h2 style="font-size:18px;">${subject}</h2>
      <p><strong>Urgency:</strong> ${input.urgency}</p>
      <p><strong>Trip:</strong> ${input.tripTitle ?? "not linked"}${
        input.tripReference ? ` (${input.tripReference})` : ""
      }</p>
      <p><strong>Customer:</strong> ${input.contactEmail ?? "unknown"}</p>
      <p style="white-space:pre-wrap;">${input.description.replace(/</g, "&lt;")}</p>
      <p style="color:#8f8b85;font-size:12px;">Request ${input.id}</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env["INVOICE_FROM_EMAIL"] ?? "Adair <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    return { sent: res.ok, ...(res.ok ? {} : { skipped: `http-${res.status}` }) };
  } catch {
    return { sent: false, skipped: "send-failed" };
  }
}
