/**
 * OAuth callback for connected calendars. The provider redirects the browser
 * here; we identify the customer from the one-time `state` row, not from a
 * session, then store encrypted tokens and send them back to Settings.
 */
import { createFileRoute } from "@tanstack/react-router";

function backTo(origin: string, status: string) {
  return new Response(null, {
    status: 302,
    headers: { location: `${origin}/preferences?calendar=${status}` },
  });
}

export const Route = createFileRoute("/api/public/calendar/callback/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const provider = params.provider === "microsoft" ? "microsoft" : "google";
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (url.searchParams.get("error") || !code || !state) return backTo(origin, "cancelled");

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const stateRes = await supabaseAdmin
            .from("calendar_oauth_states")
            .select("state, user_id, provider, redirect_uri, time_zone, created_at")
            .eq("state", state)
            .maybeSingle();
          const row = stateRes.data;
          if (!row || row.provider !== provider) return backTo(origin, "expired");
          await supabaseAdmin.from("calendar_oauth_states").delete().eq("state", state);
          if (Date.now() - Date.parse(row.created_at) > 15 * 60_000)
            return backTo(origin, "expired");

          const { exchangeCode } = await import("@/lib/calendar/providers.server");
          const { encryptToken } = await import("@/lib/calendar/crypto.server");
          const tokens = await exchangeCode(provider, {
            code,
            redirectUri: row.redirect_uri,
          });

          await supabaseAdmin.from("calendar_connections").upsert(
            {
              user_id: row.user_id,
              provider,
              account_email: tokens.email,
              access_token: await encryptToken(tokens.accessToken),
              refresh_token: tokens.refreshToken ? await encryptToken(tokens.refreshToken) : null,
              expires_at: tokens.expiresAt,
              calendar_id: "primary",
              time_zone: row.time_zone,
              // Read access only when the customer opted in for this consent.
              read_enabled: state.startsWith("read_"),
            },
            { onConflict: "user_id,provider" },
          );

          return backTo(origin, "connected");
        } catch (error) {
          console.error("calendar callback failed", error);
          return backTo(origin, "failed");
        }
      },
    },
  },
});
