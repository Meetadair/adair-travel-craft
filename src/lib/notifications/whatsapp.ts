/**
 * WhatsApp channel, built in the same shape as the other adapters and inert
 * until the two credentials exist. WhatsApp rejects free-form business
 * messages outside a 24-hour window, so every message is an approved template
 * with ordered parameters.
 */
export type WhatsAppResult =
  | { status: "sent"; id: string }
  | { status: "unavailable"; reason: "missing-key" | "no-number" }
  | { status: "failed"; detail: string };

/** Message templates, each pre-approved on the business account. */
export const WHATSAPP_TEMPLATES = {
  booking_confirmation: "adair_booking_confirmation",
  trip_reminder: "adair_trip_reminder",
  schedule_change: "adair_schedule_change",
  getaway_weekly: "adair_getaway_weekly",
  verification_code: "adair_verification_code",
} as const;

export type WhatsAppTemplate = keyof typeof WHATSAPP_TEMPLATES;

export function hasWhatsAppKeys(): boolean {
  return Boolean(process.env['WHATSAPP_API_TOKEN'] && process.env['WHATSAPP_PHONE_NUMBER_ID']);
}

/** E.164 without the plus, as the API expects. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export async function sendWhatsAppTemplate(input: {
  to: string;
  template: WhatsAppTemplate;
  /** Ordered body parameters for the approved template. */
  params: string[];
  languageCode?: string;
}): Promise<WhatsAppResult> {
  const token = process.env['WHATSAPP_API_TOKEN'];
  const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  if (!token || !phoneNumberId) return { status: "unavailable", reason: "missing-key" };

  const to = normalisePhone(input.to);
  if (!to) return { status: "unavailable", reason: "no-number" };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: WHATSAPP_TEMPLATES[input.template],
          language: { code: input.languageCode ?? "en" },
          components: input.params.length
            ? [
                {
                  type: "body",
                  parameters: input.params.map((text) => ({ type: "text", text })),
                },
              ]
            : [],
        },
      }),
    });
    if (!res.ok) return { status: "failed", detail: `http-${res.status}` };
    const body = (await res.json()) as { messages?: Array<{ id?: string }> };
    return { status: "sent", id: body.messages?.[0]?.id ?? "" };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "network" };
  }
}
