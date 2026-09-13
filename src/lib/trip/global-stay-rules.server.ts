/** Reads the editable global stay rules, with a short cache and safe fallback. */
import { DEFAULT_GLOBAL_STAY_RULES, type GlobalStayRule } from "./global-stay-rules";

let cache: { at: number; rules: GlobalStayRule[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function loadGlobalStayRules(): Promise<GlobalStayRule[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rules;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("global_stay_rules")
      .select("rule_key, label, hint, terms, allowed_types, enabled")
      .order("rule_key");
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (!rows.length) return DEFAULT_GLOBAL_STAY_RULES;
    const rules: GlobalStayRule[] = rows.map((row) => ({
      ruleKey: String(row["rule_key"]),
      label: String(row["label"]),
      hint: (row["hint"] as string | null) ?? null,
      terms: Array.isArray(row["terms"]) ? (row["terms"] as string[]) : [],
      allowedTypes: Array.isArray(row["allowed_types"]) ? (row["allowed_types"] as string[]) : [],
      enabled: Boolean(row["enabled"]),
    }));
    cache = { at: Date.now(), rules };
    return rules;
  } catch {
    // A config read must never take the search down.
    return DEFAULT_GLOBAL_STAY_RULES;
  }
}
