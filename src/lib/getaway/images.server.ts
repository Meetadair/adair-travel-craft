/**
 * Getaway pictures, server side.
 *
 * Two sources only, in this order:
 *   1. Our own photo, uploaded by the team and stored in Supabase storage.
 *   2. Unsplash, looked up by destination name, with the attribution their
 *      licence requires stored alongside the URL.
 *
 * Our own photo always wins. With no Unsplash key we return nothing at all and
 * the page falls back to a typographic header — never a broken image.
 *
 * Hotel pictures are deliberately out of scope here: once the hotel supplier is
 * enabled, its own property photos are the only honest source for those.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "getaway-images";
/** Served through our own route so the storage bucket can stay private. */
export const IMAGE_ROUTE = "/api/public/getaway-image";

export function hasUnsplashKey(): boolean {
  return Boolean(process.env["UNSPLASH_ACCESS_KEY"]);
}

export type StoredImage = {
  url: string;
  fallbackUrl: string;
  emailUrl: string;
  credit: string | null;
  creditUrl: string | null;
  source: "own" | "unsplash";
};

/** Path of an uploaded variant, served through the public image route. */
export function storagePath(kind: "destination" | "day", id: string, variant: string): string {
  return `${kind}/${id}/${variant}`;
}

export function publicUrlFor(path: string): string {
  return `${IMAGE_ROUTE}/${path}`;
}

/** Streams one stored variant. Used by the public image route. */
export async function readStoredImage(
  admin: SupabaseClient,
  path: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const res = await admin.storage.from(BUCKET).download(path);
  if (res.error || !res.data) return null;
  return {
    body: await res.data.arrayBuffer(),
    contentType: path.endsWith(".jpg") ? "image/jpeg" : "image/webp",
  };
}

/** Uploads one already-resized variant produced in the browser. */
export async function putStoredImage(
  admin: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (res.error) throw new Error(res.error.message);
}

type UnsplashPhoto = {
  urls?: { raw?: string };
  links?: { html?: string; download_location?: string };
  user?: { name?: string; links?: { html?: string } };
};

/**
 * Looks up one landscape photo for a place name. Returns null when there is no
 * key or no match — the caller then shows type, not a placeholder.
 */
export async function findUnsplashImage(query: string): Promise<StoredImage | null> {
  const key = process.env["UNSPLASH_ACCESS_KEY"];
  if (!key) return null;

  let photo: UnsplashPhoto | null = null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: UnsplashPhoto[] };
    photo = json.results?.[0] ?? null;
  } catch {
    return null;
  }
  const raw = photo?.urls?.raw;
  if (!raw) return null;

  // Unsplash asks that a use is registered against the download endpoint.
  const download = photo?.links?.download_location;
  if (download) {
    void fetch(`${download}&client_id=${key}`).catch(() => undefined);
  }

  const photographer = photo?.user?.name ?? "Unsplash";
  const profile = photo?.user?.links?.html ?? photo?.links?.html ?? "https://unsplash.com";
  const utm = "utm_source=Adair&utm_medium=referral";
  return {
    url: `${raw}&w=1600&q=72&fm=webp&fit=crop`,
    fallbackUrl: `${raw}&w=1600&q=72&fm=jpg&fit=crop`,
    // Email: 560px wide at modest quality stays well under 150 KB.
    emailUrl: `${raw}&w=560&q=62&fm=jpg&fit=crop`,
    credit: `Photo by ${photographer} on Unsplash`,
    creditUrl: `${profile}?${utm}`,
    source: "unsplash",
  };
}

type DestinationImageRow = {
  id: string;
  name: string;
  country: string;
  hero_image_url: string | null;
  hero_image_fallback_url: string | null;
  hero_image_email_url: string | null;
  hero_image_credit: string | null;
  hero_image_credit_url: string | null;
  hero_image_source: string | null;
};

/**
 * Returns the destination's picture, fetching one from Unsplash and remembering
 * it when the team has not uploaded their own. Never overwrites an own photo.
 */
export async function ensureDestinationImage(
  admin: SupabaseClient,
  dest: DestinationImageRow,
): Promise<StoredImage | null> {
  if (dest.hero_image_url) {
    return {
      url: dest.hero_image_url,
      fallbackUrl: dest.hero_image_fallback_url ?? dest.hero_image_url,
      emailUrl: dest.hero_image_email_url ?? dest.hero_image_fallback_url ?? dest.hero_image_url,
      credit: dest.hero_image_credit,
      creditUrl: dest.hero_image_credit_url,
      source: dest.hero_image_source === "unsplash" ? "unsplash" : "own",
    };
  }

  const found = await findUnsplashImage(`${dest.name} ${dest.country}`);
  if (!found) return null;

  await admin
    .from("getaway_destinations")
    .update({
      hero_image_url: found.url,
      hero_image_fallback_url: found.fallbackUrl,
      hero_image_email_url: found.emailUrl,
      hero_image_credit: found.credit,
      hero_image_credit_url: found.creditUrl,
      hero_image_source: "unsplash",
    })
    .eq("id", dest.id)
    .is("hero_image_url", null);

  return found;
}
