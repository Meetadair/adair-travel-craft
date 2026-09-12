/**
 * Serves an uploaded Getaway picture from the private store, so the bucket
 * itself stays closed. Read-only, no personal data, cacheable.
 */
import { createFileRoute } from "@tanstack/react-router";

async function serve(path: string): Promise<Response> {
  const clean = decodeURIComponent(path).replace(/\.\./g, "");
  if (!/^(destination|day)\/[0-9a-f-]{36}\/[a-z0-9-]+\.(webp|jpg)$/i.test(clean)) {
    return new Response("Not found", { status: 404 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readStoredImage } = await import("@/lib/getaway/images.server");
  const file = await readStoredImage(supabaseAdmin as never, clean);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}

export const Route = createFileRoute("/api/public/getaway-image/$")({
  server: {
    handlers: {
      GET: ({ params }) => serve((params as { _splat?: string })._splat ?? ""),
    },
  },
});
