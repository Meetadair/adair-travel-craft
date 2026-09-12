/**
 * Weekly Getaway email. Sends this week's proposal — the one already chosen in
 * the app — once per traveller per week. Without RESEND_API_KEY it does nothing
 * and says so; the in-app Getaway page always works.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { weekStartIso } from "@/lib/getaway/match";

async function run(request: Request): Promise<Response> {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { hasWhatsAppKeys } = await import("@/lib/notifications/whatsapp");
  if (!process.env['RESEND_API_KEY'] && !hasWhatsAppKeys()) {
    return Response.json({ ok: true, skipped: "no-message-channel", sent: 0 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const weekStart = weekStartIso();

  const proposalsRes = await supabaseAdmin
    .from("getaway_proposals")
    .select("id, user_id, destination_id, reasons, emailed_at")
    .eq("week_start", weekStart)
    .is("emailed_at", null)
    .limit(200);
  const proposals = (proposalsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    destination_id: string;
    reasons: string[] | null;
  }>;
  if (!proposals.length) return Response.json({ ok: true, sent: 0 });

  const destRes = await supabaseAdmin
    .from("getaway_destinations")
    .select(
      "id, name, country, editorial_note, hero_image_url, hero_image_fallback_url, hero_image_email_url, hero_image_credit, hero_image_credit_url, hero_image_source",
    )
    .in("id", proposals.map((p) => p.destination_id));
  type DestRow = {
    id: string;
    name: string;
    country: string;
    editorial_note: string | null;
    hero_image_url: string | null;
    hero_image_fallback_url: string | null;
    hero_image_email_url: string | null;
    hero_image_credit: string | null;
    hero_image_credit_url: string | null;
    hero_image_source: string | null;
  };
  const dests = new Map(((destRes.data ?? []) as DestRow[]).map((d) => [d.id, d]));
  const { ensureDestinationImage } = await import("@/lib/getaway/images.server");
  const siteOrigin = new URL(request.url).origin;

  let sent = 0;
  for (const proposal of proposals) {
    const dest = dests.get(proposal.destination_id);
    if (!dest) continue;
    const userRes = await supabaseAdmin.auth.admin.getUserById(proposal.user_id);
    const email = userRes.data.user?.email;
    if (!email) continue;

    const reasons = (proposal.reasons ?? []).map((r) => `<li>${r}</li>`).join("");

    // Picture first, then the note, then the price — same order as the app.
    // 560px wide and a small JPEG, so it stays light and shows everywhere.
    const image = await ensureDestinationImage(supabaseAdmin as never, dest).catch(() => null);
    const emailImageUrl = image
      ? (image.emailUrl.startsWith("/") ? `${siteOrigin}${image.emailUrl}` : image.emailUrl)
      : null;
    const imageBlock = emailImageUrl
      ? `<img src="${emailImageUrl}" width="560" alt="${dest.name}" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px" />${
          image?.credit
            ? `<p style="margin:6px 0 0;font-size:11px;color:#8a8378">${image.credit}</p>`
            : ""
        }`
      : `<h1 style="margin:0;font-size:28px;line-height:1.15">${dest.name}</h1>`;

    const html = `<div style="max-width:600px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;color:#1c1a17">${imageBlock}<p>This week we would go to <strong>${dest.name}</strong>, ${dest.country}.</p>${
      dest.editorial_note ? `<p>${dest.editorial_note}</p>` : ""
    }<ul>${reasons}</ul><p>Open Adair to see the price and plan it.</p></div>`;

    const { loadChannel, notifyTraveller } = await import("@/lib/notifications/send.server");
    const channel = await loadChannel(supabaseAdmin as never, proposal.user_id);
    const outcome = await notifyTraveller(supabaseAdmin as never, {
      userId: proposal.user_id,
      kind: "getaway_weekly",
      params: [dest.name, dest.country],
      email: { to: email, subject: `This week: ${dest.name}`, html },
      ...channel,
    });
    if (!outcome.whatsapp && !outcome.email) continue;

    await supabaseAdmin
      .from("getaway_proposals")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", proposal.id);
    sent += 1;
  }

  return Response.json({ ok: true, sent });
}

export const Route = createFileRoute("/api/public/getaway-weekly")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
