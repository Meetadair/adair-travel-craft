/**
 * Saved details: loyalty programmes the traveller holds, per category.
 * Numbers are stored encrypted and shown masked until tapped.
 */
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import {
  deleteMembership,
  listMemberships,
  revealMembership,
  saveMembership,
  type Membership,
} from "@/lib/loyalty.functions";
import {
  CATEGORY_LABEL,
  COMMON_TIERS,
  LOYALTY_CATEGORIES,
  PROGRAMMES,
  maskNumber,
  programmeByCode,
  type LoyaltyCategory,
} from "@/lib/loyalty/programmes";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";

type Draft = {
  programmeCode: string;
  customLabel: string;
  memberNumber: string;
  tier: string;
};

const emptyDraft: Draft = { programmeCode: "", customLabel: "", memberNumber: "", tier: "" };

/** Each category keeps its own draft, so opening one never clears another. */
type Drafts = Partial<Record<LoyaltyCategory, Draft>>;

export function WalletLoyalty() {
  const fetchList = useServerFn(listMemberships);
  const save = useServerFn(saveMembership);
  const remove = useServerFn(deleteMembership);
  const reveal = useServerFn(revealMembership);
  const queryClient = useQueryClient();

  const list = useQuery({ queryKey: ["loyalty"], queryFn: () => fetchList() });
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Drafts>({});
  const [justSaved, setJustSaved] = useState<LoyaltyCategory | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const draftFor = (category: LoyaltyCategory): Draft => drafts[category] ?? emptyDraft;
  const patchDraft = (category: LoyaltyCategory, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [category]: { ...(prev[category] ?? emptyDraft), ...patch } }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["loyalty"] });

  const addMutation = useMutation({
    mutationFn: async (category: LoyaltyCategory) => {
      const draft = draftFor(category);
      const option = programmeByCode(category, draft.programmeCode);
      const label = option?.label ?? draft.customLabel.trim();
      if (!label) throw new Error("Please choose a programme or type its name.");
      await save({
        data: {
          category,
          programmeCode: option?.code ?? "custom",
          programmeLabel: label,
          airlineIata: option?.iata ?? null,
          memberNumber: draft.memberNumber,
          tier: draft.tier.trim() || null,
        },
      });
      return category;
    },
    // The form stays open and the draft is cleared, so the next programme is
    // typed straight away rather than hunted for behind a button.
    onSuccess: async (category) => {
      setDrafts((prev) => ({ ...prev, [category]: emptyDraft }));
      setJustSaved(category);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const revealMutation = useMutation({
    mutationFn: (id: string) => reveal({ data: { id } }),
    onSuccess: (result, id) => setRevealed((prev) => ({ ...prev, [id]: result.memberNumber })),
  });

  const openForm = (category: LoyaltyCategory) => {
    setJustSaved(null);
    addMutation.reset();
    setDrafts((prev) => ({ ...prev, [category]: emptyDraft }));
    setOpen((prev) => ({ ...prev, [category]: true }));
  };

  const forCategory = (category: LoyaltyCategory): Membership[] =>
    (list.data ?? []).filter((m) => m.category === category);

  return (
    <section className="hairline-card space-y-5 p-5 sm:p-6" id="wallet">
      <div>
        <h2 className="font-display text-lg font-semibold">Saved details — loyalty programmes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add as many as you hold. We pass the number to the airline, hotel or rental desk at
          booking, and show on the confirmation which ones were accepted.
        </p>
      </div>

      {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {LOYALTY_CATEGORIES.map((category) => (
        <div key={category} className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {CATEGORY_LABEL[category]}
          </p>

          {forCategory(category).map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.programmeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {m.hasNumber ? (revealed[m.id] ?? maskNumber(m.last4)) : "No member number"}
                  {m.tier ? ` · ${m.tier}` : ""}
                </p>
                {!m.hasNumber && (
                  <p className="mt-1 text-xs text-primary">
                    Incomplete — without your member number, miles won't be credited.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {m.hasNumber && !revealed[m.id] && (
                  <button
                    type="button"
                    onClick={() => revealMutation.mutate(m.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4"
                  >
                    <Eye className="size-3.5" /> Show
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(m.id)}
                  aria-label={`Remove ${m.programmeLabel}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}

          {justSaved === category && (
            <p className="text-xs text-muted-foreground">
              Saved. Add another if you hold more than one, or close this when you're done.
            </p>
          )}

          {open[category] ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Programme</span>
                <select
                  value={draftFor(category).programmeCode}
                  onChange={(e) => patchDraft(category, { programmeCode: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Other (type the name)</option>
                  {PROGRAMMES[category].map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              {!draftFor(category).programmeCode && (
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">Programme name</span>
                  <input
                    value={draftFor(category).customLabel}
                    onChange={(e) => patchDraft(category, { customLabel: e.target.value })}
                    placeholder="Programme name"
                    className={inputClass}
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Member number</span>
                <input
                  value={draftFor(category).memberNumber}
                  onChange={(e) => patchDraft(category, { memberNumber: e.target.value })}
                  inputMode="text"
                  autoComplete="off"
                  className={inputClass}
                />
                {draftFor(category).memberNumber.trim().length < 4 && (
                  <span className="mt-1 block text-xs text-primary">
                    Without your member number, miles won't be credited.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Tier or status — optional
                </span>
                <input
                  value={draftFor(category).tier}
                  onChange={(e) => patchDraft(category, { tier: e.target.value })}
                  placeholder={COMMON_TIERS.join(", ")}
                  className={inputClass}
                />
              </label>

              {addMutation.isError && (
                <p className="text-sm text-primary">{(addMutation.error as Error).message}</p>
              )}

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => addMutation.mutate(category)}
                  disabled={addMutation.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {addMutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen((prev) => ({ ...prev, [category]: false }));
                    setDrafts((prev) => ({ ...prev, [category]: emptyDraft }));
                    setJustSaved(null);
                  }}
                  className="text-sm text-muted-foreground underline decoration-border underline-offset-4"
                >
                  {justSaved === category ? "Done" : "Cancel"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openForm(category)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:border-primary"
            >
              <Plus className="size-4" />{" "}
              {forCategory(category).length
                ? `Add another ${CATEGORY_LABEL[category].toLowerCase()} programme`
                : `Add ${CATEGORY_LABEL[category].toLowerCase()} programme`}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
