/** A company being typed in, before it is saved. Shared by onboarding + preferences. */

export type CompanyDraft = {
  name: string;
  legalForm: string | null;
  country: string | null;
  city: string | null;
  postcode: string | null;
  street: string | null;
  building: string | null;
  addressExtra: string | null;
  vatId: string | null;
  invoiceEmails: string[];
  isDefault: boolean;
};

export const emptyCompany = (): CompanyDraft => ({
  name: "",
  legalForm: null,
  country: "PL",
  city: null,
  postcode: null,
  street: null,
  building: null,
  addressExtra: null,
  vatId: null,
  invoiceEmails: [""],
  isDefault: false,
});

/** Trimmed, valid-looking copy ready for the server. */
export function cleanCompany(draft: CompanyDraft): CompanyDraft {
  const text = (value: string | null) => {
    const v = (value ?? "").trim();
    return v.length ? v : null;
  };
  return {
    name: draft.name.trim(),
    legalForm: text(draft.legalForm),
    country: text(draft.country),
    city: text(draft.city),
    postcode: text(draft.postcode),
    street: text(draft.street),
    building: text(draft.building),
    addressExtra: text(draft.addressExtra),
    vatId: text(draft.vatId),
    invoiceEmails: draft.invoiceEmails.map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e)),
    isDefault: draft.isDefault,
  };
}

export function companySummary(draft: CompanyDraft): string {
  return [
    [draft.name, draft.legalForm].filter(Boolean).join(" "),
    [draft.postcode, draft.city].filter(Boolean).join(" "),
    draft.vatId,
  ]
    .filter((part) => part && part.length)
    .join(" · ");
}
