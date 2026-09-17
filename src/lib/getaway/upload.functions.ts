/**
 * Admin-only picture handling for Getaway: upload our own photo, ask Unsplash
 * for one, or clear a picture again. Nothing here invents a picture — with no
 * upload and no Unsplash key the destination simply has none.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not verify your account");
  if (!data?.["is_admin"]) throw new Error("Admins only");
}

const dataUrl = z
  .string()
  .max(9_000_000)
  .regex(/^data:image\/(webp|jpeg);base64,/);

function bytesOf(value: string): Uint8Array {
  const base64 = value.slice(value.indexOf(",") + 1);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

const target = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("destination"), id: z.string().uuid() }),
  z.object({ kind: z.literal("day"), id: z.string().uuid() }),
]);

/** Stores the three variants the browser produced and records the URLs. */
export const uploadGetawayImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        target,
        webp: dataUrl,
        jpeg: dataUrl,
        emailJpeg: dataUrl,
        credit: z.string().trim().max(200).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { putStoredImage, publicUrlFor, storagePath } =
      await import("@/lib/getaway/images.server");

    const stamp = Date.now().toString(36);
    const paths = {
      webp: storagePath(data.target.kind, data.target.id, `hero-${stamp}.webp`),
      jpeg: storagePath(data.target.kind, data.target.id, `hero-${stamp}.jpg`),
      email: storagePath(data.target.kind, data.target.id, `email-${stamp}.jpg`),
    };

    await putStoredImage(supabaseAdmin as never, paths.webp, bytesOf(data.webp), "image/webp");
    await putStoredImage(supabaseAdmin as never, paths.jpeg, bytesOf(data.jpeg), "image/jpeg");
    await putStoredImage(
      supabaseAdmin as never,
      paths.email,
      bytesOf(data.emailJpeg),
      "image/jpeg",
    );

    if (data.target.kind === "destination") {
      const res = await context.supabase
        .from("getaway_destinations")
        .update({
          hero_image_url: publicUrlFor(paths.webp),
          hero_image_fallback_url: publicUrlFor(paths.jpeg),
          hero_image_email_url: publicUrlFor(paths.email),
          hero_image_credit: data.credit,
          hero_image_credit_url: null,
          hero_image_source: "own",
        })
        .eq("id", data.target.id);
      if (res.error) throw new Error(res.error.message);
    } else {
      const res = await context.supabase
        .from("getaway_itinerary_days")
        .update({
          image_url: publicUrlFor(paths.webp),
          image_fallback_url: publicUrlFor(paths.jpeg),
          image_credit: data.credit,
          image_credit_url: null,
          image_source: "own",
        })
        .eq("id", data.target.id);
      if (res.error) throw new Error(res.error.message);
    }
    return { ok: true, url: publicUrlFor(paths.webp) };
  });

/** Asks Unsplash for a picture. Only ever used where we have no own photo. */
export const fetchGetawayStockImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ target, query: z.string().trim().min(2).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { findUnsplashImage } = await import("@/lib/getaway/images.server");
    const found = await findUnsplashImage(data.query);
    if (!found) return { ok: false as const, reason: "no-image" as const };

    if (data.target.kind === "destination") {
      await context.supabase
        .from("getaway_destinations")
        .update({
          hero_image_url: found.url,
          hero_image_fallback_url: found.fallbackUrl,
          hero_image_email_url: found.emailUrl,
          hero_image_credit: found.credit,
          hero_image_credit_url: found.creditUrl,
          hero_image_source: "unsplash",
        })
        .eq("id", data.target.id);
    } else {
      await context.supabase
        .from("getaway_itinerary_days")
        .update({
          image_url: found.url,
          image_fallback_url: found.fallbackUrl,
          image_credit: found.credit,
          image_credit_url: found.creditUrl,
          image_source: "unsplash",
        })
        .eq("id", data.target.id);
    }
    return { ok: true as const, url: found.url, credit: found.credit };
  });

export const clearGetawayImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ target }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.target.kind === "destination") {
      await context.supabase
        .from("getaway_destinations")
        .update({
          hero_image_url: null,
          hero_image_fallback_url: null,
          hero_image_email_url: null,
          hero_image_credit: null,
          hero_image_credit_url: null,
          hero_image_source: null,
        })
        .eq("id", data.target.id);
    } else {
      await context.supabase
        .from("getaway_itinerary_days")
        .update({
          image_url: null,
          image_fallback_url: null,
          image_credit: null,
          image_credit_url: null,
          image_source: null,
        })
        .eq("id", data.target.id);
    }
    return { ok: true };
  });
