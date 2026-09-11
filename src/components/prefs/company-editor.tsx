/** Add / edit / delete invoicing companies, with several invoice emails each. */
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { COUNTRIES, legalFormsFor } from "@/lib/prefs/questions";
import { companySummary, emptyCompany, type CompanyDraft } from "@/lib/prefs/company-draft";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const labelText = "text-xs font-medium text-muted-foreground";

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelText}>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function CompanyForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CompanyDraft;
  onChange: (next: CompanyDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const forms = legalFormsFor(draft.country ?? "OTHER");
  const set = (patch: Partial<CompanyDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <Field label="Company name" value={draft.name} onChange={(v) => set({ name: v })} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>Country</span>
          <select
            value={draft.country ?? "OTHER"}
            onChange={(e) => set({ country: e.target.value, legalForm: null })}
            className={inputClass}
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {forms.length ? (
          <label className="block">
            <span className={labelText}>Legal form</span>
            <select
              value={draft.legalForm ?? ""}
              onChange={(e) => set({ legalForm: e.target.value || null })}
              className={inputClass}
            >
              <option value="">Select…</option>
              {forms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value="__other">Other</option>
            </select>
          </label>
        ) : (
          <Field
            label="Legal form"
            value={draft.legalForm === "__other" ? "" : draft.legalForm}
            onChange={(v) => set({ legalForm: v })}
            placeholder="e.g. Ltd"
          />
        )}
      </div>

      {draft.legalForm === "__other" && (
        <Field label="Legal form (other)" value="" onChange={(v) => set({ legalForm: v })} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City" value={draft.city} onChange={(v) => set({ city: v })} />
        <Field label="Postcode" value={draft.postcode} onChange={(v) => set({ postcode: v })} />
        <Field label="Street" value={draft.street} onChange={(v) => set({ street: v })} />
        <Field
          label="Building / unit"
          value={draft.building}
          onChange={(v) => set({ building: v })}
        />
      </div>

      <Field
        label="Other address line"
        value={draft.addressExtra}
        onChange={(v) => set({ addressExtra: v })}
      />
      <Field label="VAT number" value={draft.vatId} onChange={(v) => set({ vatId: v })} />

      <div>
        <span className={labelText}>Invoice email addresses</span>
        <div className="mt-1 space-y-2">
          {draft.invoiceEmails.map((email, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  const next = [...draft.invoiceEmails];
                  next[index] = e.target.value;
                  set({ invoiceEmails: next });
                }}
                placeholder="invoices@company.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              {draft.invoiceEmails.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove email"
                  onClick={() =>
                    set({ invoiceEmails: draft.invoiceEmails.filter((_, i) => i !== index) })
                  }
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set({ invoiceEmails: [...draft.invoiceEmails, ""] })}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary underline decoration-border underline-offset-4"
        >
          <Plus className="size-3.5" /> Add another email
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(e) => set({ isDefault: e.target.checked })}
          className="size-4 accent-[hsl(var(--primary))]"
        />
        Default company
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.name.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-4" /> Save company
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground underline decoration-border underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CompanyEditor({
  companies,
  onChange,
}: {
  companies: CompanyDraft[];
  onChange: (next: CompanyDraft[]) => void;
}) {
  const [draft, setDraft] = useState<CompanyDraft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const commit = () => {
    if (!draft) return;
    const next = [...companies];
    if (draft.isDefault) next.forEach((c) => (c.isDefault = false));
    if (editing === null) next.push(draft);
    else next[editing] = draft;
    onChange(next);
    setDraft(null);
    setEditing(null);
  };

  return (
    <div className="space-y-3">
      {companies.map((company, index) => (
        <div
          key={index}
          className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {company.name} {company.legalForm ?? ""}
              {company.isDefault && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Default
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {companySummary(company)}
            </p>
            {company.invoiceEmails.filter(Boolean).length > 0 && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {company.invoiceEmails.filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label="Edit company"
              onClick={() => {
                setDraft({ ...company });
                setEditing(index);
              }}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Delete company"
              onClick={() => onChange(companies.filter((_, i) => i !== index))}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {draft ? (
        <CompanyForm
          draft={draft}
          onChange={setDraft}
          onSave={commit}
          onCancel={() => {
            setDraft(null);
            setEditing(null);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(emptyCompany());
            setEditing(null);
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium hover:border-foreground/30"
        >
          <Plus className="size-4" /> Add company
        </button>
      )}
    </div>
  );
}
