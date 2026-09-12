/**
 * One place that decides how a traveller is reached. WhatsApp only when they
 * chose it, verified their number, and the credentials exist; otherwise email.
 * A WhatsApp failure falls back to email silently. Every attempt is logged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasWhatsAppKeys, sendWhatsAppTemplate, type WhatsAppTemplate } from "./whatsapp";

export type NotifyKind =
  | "booking_confirmation"
  | "trip_reminder"
  | "schedule_change"
  | "getaway_weekly"
  | "verification_code";

export type NotifyOutcome = { whatsapp: boolean; email: boolean };

type EmailPayload = { to: string; subject: string; html: string } | null;

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey || !payload) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env['RESEND_FROM'] ?? "Adair <onboarding@resend.dev>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function log(
  supabase: SupabaseClient,
  row: {
    user_id: string | null;
    channel: string;
    template: string;
    kind: string;
    status: string;
    detail?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("notification_log").insert(row);
  } catch (error) {
    console.error("Could not log notification", error);
  }
}

export async function notifyTraveller(
  supabase: SupabaseClient,
  input: {
    userId: string | null;
    kind: NotifyKind;
    /** Ordered parameters for the approved WhatsApp template. */
    params: string[];
    email: EmailPayload;
    /** Channel choice and verified number; loaded by the caller when known. */
    channel?: string;
    phone?: string | null;
    verified?: boolean;
  },
): Promise<NotifyOutcome> {
  const template = input.kind as WhatsAppTemplate;
  const channel = input.channel ?? "email";
  const wantsWhatsApp = channel === "whatsapp" || channel === "both";
  let whatsappSent = false;

  if (wantsWhatsApp && input.phone && input.verified && hasWhatsAppKeys()) {
    const result = await sendWhatsAppTemplate({
      to: input.phone,
      template,
      params: input.params,
    });
    whatsappSent = result.status === "sent";
    await log(supabase, {
      user_id: input.userId,
      channel: "whatsapp",
      template,
      kind: input.kind,
      status: result.status,
      detail: result.status === "sent" ? null : JSON.stringify(result),
    });
  }

  // Email is the default and the silent fallback when WhatsApp didn't land.
  const needsEmail = channel !== "whatsapp" || !whatsappSent;
  let emailSent = false;
  if (needsEmail && input.email) {
    emailSent = await sendEmail(input.email);
    await log(supabase, {
      user_id: input.userId,
      channel: "email",
      template,
      kind: input.kind,
      status: emailSent ? "sent" : "failed",
    });
  }

  return { whatsapp: whatsappSent, email: emailSent };
}

/** Channel settings for one traveller, safe defaults when nothing is stored. */
export async function loadChannel(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ channel: string; phone: string | null; verified: boolean }> {
  const { data } = await supabase
    .from("profiles")
    .select("notify_channel, whatsapp_phone, whatsapp_verified_at")
    .eq("id", userId)
    .maybeSingle();
  const row = (data ?? null) as Record<string, unknown> | null;
  return {
    channel: (row?.["notify_channel"] as string) ?? "email",
    phone: (row?.["whatsapp_phone"] as string | null) ?? null,
    verified: Boolean(row?.["whatsapp_verified_at"]),
  };
}
