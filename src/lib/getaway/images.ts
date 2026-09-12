/**
 * Shared shape for a Getaway picture. Browser-safe: no keys, no server imports.
 * A missing picture is a real state — the page shows a typographic header
 * instead, never a grey box.
 */
export type GetawayImage = {
  /** WebP, wide. */
  url: string;
  /** JPEG of the same picture, for anything that cannot show WebP. */
  fallbackUrl: string | null;
  /** Attribution line. Required by Unsplash, and fair for our own photos too. */
  credit: string | null;
  creditUrl: string | null;
  source: "own" | "unsplash";
};

export function toGetawayImage(row: {
  hero_image_url?: string | null;
  hero_image_fallback_url?: string | null;
  hero_image_credit?: string | null;
  hero_image_credit_url?: string | null;
  hero_image_source?: string | null;
}): GetawayImage | null {
  if (!row.hero_image_url) return null;
  return {
    url: row.hero_image_url,
    fallbackUrl: row.hero_image_fallback_url ?? null,
    credit: row.hero_image_credit ?? null,
    creditUrl: row.hero_image_credit_url ?? null,
    source: row.hero_image_source === "unsplash" ? "unsplash" : "own",
  };
}

export function toDayImage(row: {
  image_url?: string | null;
  image_fallback_url?: string | null;
  image_credit?: string | null;
  image_credit_url?: string | null;
  image_source?: string | null;
}): GetawayImage | null {
  if (!row.image_url) return null;
  return {
    url: row.image_url,
    fallbackUrl: row.image_fallback_url ?? null,
    credit: row.image_credit ?? null,
    creditUrl: row.image_credit_url ?? null,
    source: row.image_source === "unsplash" ? "unsplash" : "own",
  };
}
