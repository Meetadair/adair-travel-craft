/**
 * Notification channel settings. WhatsApp is only offered when the credentials
 * exist, and a number is confirmed with a one-time code before anything is
 * sent to it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationSettings = {
  channel: "email" | "whatsapp" | "both";
  /** Masked for display; only the last four digits are shown. */
  phoneMasked: string | null;
  verified: boolean;
  /** False hides the WhatsApp option entirely — no broken half-state. */
  whatsappAvailable: boolean;
  pendingPhoneMasked: string | null;
};

const mask = (phone: string | null): string | null => (phone ? `••• ${phone.slice(-4)}` : null);

export const getNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationSettings> => {
    const { hasWhatsAppKeys } = await import("@/lib/notifications/whatsapp");
    const [profileRes, pendingRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("notify_channel, whatsapp_phone, whatsapp_verified_at")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("whatsapp_verifications")
        .select("phone, expires_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const row = (profileRes.data ?? null) as Record<string, unknown> | null;
    const pending = (pendingRes.data ?? null) as { phone: string; expires_at: string } | null;
    const live = pending && Date.parse(pending.expires_at) > Date.now() ? pending : null;
    return {
      channel: (row?.["notify_channel"] as NotificationSettings["channel"]) ?? "email",
      phoneMasked: mask((row?.["whatsapp_phone"] as string | null) ?? null),
      verified: Boolean(row?.["whatsapp_verified_at"]),
      whatsappAvailable: hasWhatsAppKeys(),
      pendingPhoneMasked: mask(live?.phone ?? null),
    };
  });

export const setNotificationChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ channel: z.enum(["email", "whatsapp", "both"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.channel !== "email") {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("whatsapp_verified_at")
        .eq("id", context.userId)
        .maybeSingle();
      if (!(profile as { whatsapp_verified_at?: string } | null)?.whatsapp_verified_at) {
        throw new Error("verify-number-first");
      }
    }
    const res = await context.supabase
      .from("profiles")
      .update({ notify_channel: data.channel })
      .eq("id", context.userId);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

async function hashCode(userId: string, code: string): Promise<string> {
  const { createHash } = await import("crypto");
  const pepper = process.env["TRAVELLER_DATA_KEY"] ?? "";
  return createHash("sha256").update(`${userId}:${code}:${pepper}`).digest("hex");
}

export const startWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ phone: z.string().trim().min(8).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { hasWhatsAppKeys, normalisePhone, sendWhatsAppTemplate } =
      await import("@/lib/notifications/whatsapp");
    if (!hasWhatsAppKeys()) throw new Error("whatsapp-not-configured");
    const phone = normalisePhone(data.phone);
    if (!phone) throw new Error("invalid-phone");

    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const res = await context.supabase.from("whatsapp_verifications").upsert(
      {
        user_id: context.userId,
        phone,
        code_hash: await hashCode(context.userId, code),
        attempts: 0,
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (res.error) throw new Error(res.error.message);

    const sent = await sendWhatsAppTemplate({
      to: phone,
      template: "verification_code",
      params: [code],
    });
    await context.supabase.from("notification_log").insert({
      user_id: context.userId,
      channel: "whatsapp",
      template: "verification_code",
      kind: "verification_code",
      status: sent.status,
      detail: sent.status === "sent" ? null : JSON.stringify(sent),
    });
    if (sent.status !== "sent") throw new Error("could-not-send-code");
    return { ok: true };
  });

export const confirmWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^\d{6}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("whatsapp_verifications")
      .select("phone, code_hash, attempts, expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const pending = (row ?? null) as {
      phone: string;
      code_hash: string;
      attempts: number;
      expires_at: string;
    } | null;
    if (!pending) throw new Error("no-code-requested");
    if (Date.parse(pending.expires_at) < Date.now()) throw new Error("code-expired");
    if (pending.attempts >= 5) throw new Error("too-many-attempts");

    if ((await hashCode(context.userId, data.code)) !== pending.code_hash) {
      await context.supabase
        .from("whatsapp_verifications")
        .update({ attempts: pending.attempts + 1 })
        .eq("user_id", context.userId);
      throw new Error("wrong-code");
    }

    const update = await context.supabase
      .from("profiles")
      .update({ whatsapp_phone: pending.phone, whatsapp_verified_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (update.error) throw new Error(update.error.message);
    await context.supabase.from("whatsapp_verifications").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const removeWhatsAppNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const res = await context.supabase
      .from("profiles")
      .update({ whatsapp_phone: null, whatsapp_verified_at: null, notify_channel: "email" })
      .eq("id", context.userId);
    if (res.error) throw new Error(res.error.message);
    await context.supabase.from("whatsapp_verifications").delete().eq("user_id", context.userId);
    return { ok: true };
  });
