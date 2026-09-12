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
    .select("id, name, country, editorial_note")
    .in("id", proposals.map((p) => p.destination_id));
  const dests = new Map(
    ((destRes.data ?? []) as Array<{ id: string; name: string; country: string; editorial_note: string | null }>).map(
      (d) => [d.id, d],
    ),
  );

  let sent = 0;
  for (const proposal of proposals) {
    const dest = dests.get(proposal.destination_id);
    if (!dest) continue;
    const userRes = await supabaseAdmin.auth.admin.getUserById(proposal.user_id);
    const email = userRes.data.user?.email;
    if (!email) continue;

    const reasons = (proposal.reasons ?? []).map((r) => `<li>${r}</li>`).join("");
    const html = `<p>This week we would go to <strong>${dest.name}</strong>, ${dest.country}.</p>${
      dest.editorial_note ? `<p>${dest.editorial_note}</p>` : ""
    }<ul>${reasons}</ul><p>Open Adair to see the price and plan it.</p>`;

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
