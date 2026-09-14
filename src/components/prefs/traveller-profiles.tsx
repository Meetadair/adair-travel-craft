/**
 * "People I travel with" — the account holder's own traveller details plus
 * anyone they book alongside. Saved once here, these are what pre-fill the
 * passenger form at checkout, so nobody retypes a passport number every time.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import {
  deleteTraveller,
  listTravellers,
  saveTraveller,
  type Relationship,
  type Traveller,
} from "@/lib/companions.functions";

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";
const labelText = "text-xs font-medium text-muted-foreground";

type Draft = {
  id: string | undefined;
  isSelf: boolean;
  relationship: Relationship | null;
  givenName: string;
  familyName: string;
  title: string;
  gender: string;
  bornOn: string;
  email: string;
  phone: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressPostcode: string;
  addressCountry: string;
};

const RELATIONSHIP_LABEL: Record<Exclude<Relationship, "self">, string> = {
  spouse: "Spouse",
  partner: "Partner",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  colleague: "Colleague",
  friend: "Friend",
  other: "Other",
};

function draftFrom(t: Traveller | null, isSelf: boolean): Draft {
  return {
    id: t?.id,
    isSelf,
    relationship: t?.relationship ?? (isSelf ? "self" : null),
    givenName: t?.givenName ?? "",
    familyName: t?.familyName ?? "",
    title: t?.title ?? (isSelf ? "mr" : "ms"),
    gender: t?.gender ?? (isSelf ? "m" : "f"),
    bornOn: t?.bornOn ?? "",
    email: t?.email ?? "",
    phone: t?.phone ?? "",
    passportNumber: t?.passportNumber ?? "",
    passportCountry: t?.passportCountry ?? "",
    passportExpiry: t?.passportExpiry ?? "",
    addressLine1: t?.addressLine1 ?? "",
    addressLine2: t?.addressLine2 ?? "",
    addressCity: t?.addressCity ?? "",
    addressPostcode: t?.addressPostcode ?? "",
    addressCountry: t?.addressCountry ?? "",
  };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelText}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

function TravellerForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const canSave = draft.givenName.trim().length > 0 && draft.familyName.trim().length > 0;

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {!draft.isSelf && (
        <label className="block">
          <span className={labelText}>Relationship</span>
          <select
            value={draft.relationship ?? "other"}
            onChange={(e) => set({ relationship: e.target.value as Relationship })}
            className={inputClass}
          >
            {(Object.keys(RELATIONSHIP_LABEL) as Array<keyof typeof RELATIONSHIP_LABEL>).map(
              (key) => (
                <option key={key} value={key}>
                  {RELATIONSHIP_LABEL[key]}
                </option>
              ),
            )}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelText}>Title</span>
          <select
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            className={inputClass}
          >
            <option value="mr">Mr</option>
            <option value="ms">Ms</option>
            <option value="mrs">Mrs</option>
            <option value="dr">Dr</option>
            <option value="mx">Mx</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Field
            label="Given name"
            value={draft.givenName}
            onChange={(v) => set({ givenName: v })}
          />
        </div>
      </div>

      <Field
        label="Family name"
        value={draft.familyName}
        onChange={(v) => set({ familyName: v })}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>Gender (as on passport)</span>
          <select
            value={draft.gender}
            onChange={(e) => set({ gender: e.target.value })}
            className={inputClass}
          >
            <option value="m">Male</option>
            <option value="f">Female</option>
            <option value="x">X</option>
          </select>
        </label>
        <Field
          label="Date of birth"
          type="date"
          value={draft.bornOn}
          onChange={(v) => set({ bornOn: v })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" type="email" value={draft.email} onChange={(v) => set({ email: v })} />
        <Field label="Phone" type="tel" value={draft.phone} onChange={(v) => set({ phone: v })} />
      </div>

      <div>
        <p className={`${labelText} mb-1`}>Passport</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Number"
            value={draft.passportNumber}
            onChange={(v) => set({ passportNumber: v })}
          />
          <Field
            label="Issuing country (e.g. PL)"
            value={draft.passportCountry}
            onChange={(v) => set({ passportCountry: v.toUpperCase() })}
          />
          <Field
            label="Expires"
            type="date"
            value={draft.passportExpiry}
            onChange={(v) => set({ passportExpiry: v })}
          />
        </div>
      </div>

      {draft.isSelf && (
        <div>
          <p className={`${labelText} mb-1`}>Billing address</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Address line 1"
              value={draft.addressLine1}
              onChange={(v) => set({ addressLine1: v })}
            />
            <Field
              label="Address line 2"
              value={draft.addressLine2}
              onChange={(v) => set({ addressLine2: v })}
            />
            <Field
              label="City"
              value={draft.addressCity}
              onChange={(v) => set({ addressCity: v })}
            />
            <Field
              label="Postcode"
              value={draft.addressPostcode}
              onChange={(v) => set({ addressPostcode: v })}
            />
            <Field
              label="Country (e.g. PL)"
              value={draft.addressCountry}
              onChange={(v) => set({ addressCountry: v.toUpperCase() })}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Check className="size-4" /> {saving ? "Saving…" : "Save"}
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

function summaryLine(t: Traveller): string {
  const parts: string[] = [];
  if (t.bornOn) parts.push(`born ${t.bornOn}`);
  if (t.passportLast4) parts.push(`passport ···· ${t.passportLast4}`);
  if (!t.passportLast4 && !t.bornOn) parts.push("no details saved yet");
  return parts.join(" · ");
}

export function TravellerProfiles() {
  const fetchList = useServerFn(listTravellers);
  const save = useServerFn(saveTraveller);
  const remove = useServerFn(deleteTraveller);
  const queryClient = useQueryClient();

  const travellers = useQuery({ queryKey: ["travellers"], queryFn: () => fetchList() });
  const [draft, setDraft] = useState<Draft | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["travellers"] });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          isSelf: d.isSelf,
          relationship: d.isSelf ? "self" : (d.relationship ?? "other"),
          givenName: d.givenName,
          familyName: d.familyName,
          title: d.title as "mr" | "ms" | "mrs" | "dr" | "mx",
          gender: d.gender as "m" | "f" | "x",
          bornOn: d.bornOn || null,
          email: d.email || null,
          phone: d.phone || null,
          passportNumber: d.passportNumber || null,
          passportCountry: d.passportCountry || null,
          passportExpiry: d.passportExpiry || null,
          addressLine1: d.addressLine1 || null,
          addressLine2: d.addressLine2 || null,
          addressCity: d.addressCity || null,
          addressPostcode: d.addressPostcode || null,
          addressCountry: d.addressCountry || null,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      void refresh();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
  });

  const list = travellers.data ?? [];
  const self = list.find((t) => t.isSelf) ?? null;
  const companions = list.filter((t) => !t.isSelf);

  return (
    <section className="hairline-card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">People I travel with</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save these once and Adair fills them in at checkout — for you and for who you're flying
          with.
        </p>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <UserRound className="size-3.5" /> You
        </p>
        {draft?.isSelf ? (
          <TravellerForm
            draft={draft}
            onChange={setDraft}
            onSave={() => saveMutation.mutate(draft)}
            onCancel={() => setDraft(null)}
            saving={saveMutation.isPending}
          />
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {self ? `${self.givenName} ${self.familyName}` : "Not filled in yet"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {self
                  ? [self.email, self.phone].filter(Boolean).join(" · ") || summaryLine(self)
                  : "Add your own passport, phone and email once — it pre-fills every booking."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Edit your details"
              onClick={() => setDraft(draftFrom(self, true))}
              className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <Users className="size-3.5" /> Family &amp; companions
        </p>
        <div className="space-y-3">
          {companions.map((t) =>
            draft?.id === t.id ? (
              <TravellerForm
                key={t.id}
                draft={draft}
                onChange={setDraft}
                onSave={() => saveMutation.mutate(draft)}
                onCancel={() => setDraft(null)}
                saving={saveMutation.isPending}
              />
            ) : (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t.givenName} {t.familyName}
                    {t.relationship && t.relationship !== "self" && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {RELATIONSHIP_LABEL[t.relationship as Exclude<Relationship, "self">]}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{summaryLine(t)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => setDraft(draftFrom(t, false))}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeMutation.mutate(t.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ),
          )}

          {draft && !draft.isSelf && !draft.id ? (
            <TravellerForm
              draft={draft}
              onChange={setDraft}
              onSave={() => saveMutation.mutate(draft)}
              onCancel={() => setDraft(null)}
              saving={saveMutation.isPending}
            />
          ) : (
            <button
              type="button"
              onClick={() => setDraft(draftFrom(null, false))}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium hover:border-foreground/30"
            >
              <Plus className="size-4" /> Add family member
            </button>
          )}
        </div>
      </div>

      {saveMutation.isError && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <X className="size-4" /> We could not save that. Please try again.
        </p>
      )}
    </section>
  );
}
