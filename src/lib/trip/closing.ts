/**
 * Closing the booking inside the conversation.
 *
 * Adair asks only about what it does not already know. One saved company and
 * one saved card means zero questions: a single summary line and one button.
 * Everything here is pure so it can be tested without a browser.
 */

export type ClosingCompany = { id: string; name: string; isDefault: boolean };

export type ClosingCard = {
  id: string;
  brand: string | null;
  last4: string | null;
  isDefault: boolean;
};

/** Something the customer already asked for in their sentence. */
export type ClosingExtra = { id: string; label: string };

export type ClosingQuestionKind =
  | "invoice_choose"
  | "invoice_company_name"
  | "card_confirm"
  | "card_choose"
  | "card_new"
  | "traveller_details"
  | "companions_choose";

export type ClosingOption = { value: string; label: string };

export type ClosingQuestion = {
  kind: ClosingQuestionKind;
  question: string;
  options: ClosingOption[];
  /** True when nothing can be booked until this is answered. */
  essential: boolean;
};

export type ClosingInput = {
  companies: ClosingCompany[];
  cards: ClosingCard[];
  /** The sentence mentioned an invoice, a company or VAT. */
  invoiceMentioned: boolean;
  extras: ClosingExtra[];
  /** Route leaves the visa-free area and we hold no passport for someone. */
  passportRequired: boolean;
  /** Lead traveller name, email, phone and date of birth are all on file. */
  travellerComplete: boolean;
  /** Seats requested for this trip, lead traveller included. */
  partySize: number;
  /** Companions already picked (from saved people or typed in) this session. */
  companionsChosen: number;
};

export type Closing = {
  questions: ClosingQuestion[];
  /** Chosen without asking, because only one was saved. */
  companyId: string | null;
  cardId: string | null;
  /** One line confirming extras from the sentence, with a Remove on each. */
  extras: ClosingExtra[];
  extrasLine: string | null;
  /** Set when this trip has to finish on the /book page instead. */
  fallback: "passport" | null;
};

const cardLabel = (card: ClosingCard) =>
  `${card.brand ? card.brand.replace(/_/g, " ") : "card"} ${card.last4 ?? "····"}`.trim();

function pickDefault<T extends { isDefault: boolean }>(list: T[]): T | null {
  return list.find((item) => item.isDefault) ?? list[0] ?? null;
}

/** Joins extras into "Adding the 7pm table and the airport transfer." */
export function extrasSentence(extras: ClosingExtra[]): string | null {
  if (extras.length === 0) return null;
  const labels = extras.map((extra) => extra.label);
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `Adding ${list}.`;
}

/** What still has to be settled before the trip can be booked from the chat. */
export function buildClosing(input: ClosingInput): Closing {
  const questions: ClosingQuestion[] = [];

  // ---- invoice ----
  // One company saved: take it, and say so in the summary. Nothing to ask.
  const companyId: string | null = input.companies.length === 1 ? input.companies[0]!.id : null;
  if (input.companies.length > 1) {
    questions.push({
      kind: "invoice_choose",
      question: "Which company for the invoice?",
      options: [
        ...input.companies.map((company) => ({ value: company.id, label: company.name })),
        { value: "none", label: "No invoice" },
      ],
      essential: false,
    });
  } else if (input.companies.length === 0 && input.invoiceMentioned) {
    questions.push({
      kind: "invoice_company_name",
      question: "Which company should the invoice go to?",
      options: [],
      essential: false,
    });
  }
  // No company saved and no invoice mentioned: the receipt goes to them personally.

  // ---- traveller identity (only when we do not hold it yet) ----
  if (!input.travellerComplete) {
    questions.push({
      kind: "traveller_details",
      question: "I need your details for the ticket, once.",
      options: [],
      essential: true,
    });
  }

  // ---- who else is travelling (party of more than one) ----
  const companionsNeeded = Math.max(0, input.partySize - 1);
  if (companionsNeeded > 0 && input.companionsChosen < companionsNeeded) {
    questions.push({
      kind: "companions_choose",
      question: "Who else is travelling?",
      options: [],
      essential: true,
    });
  }

  // ---- payment ----
  let cardIdChosen: string | null = null;
  if (input.cards.length === 1) {
    cardIdChosen = pickDefault(input.cards)!.id;
  } else if (input.cards.length > 1) {
    questions.push({
      kind: "card_choose",
      question: "Which card?",
      options: [
        ...input.cards.map((card) => ({ value: card.id, label: cardLabel(card) })),
        { value: "new", label: "Another card" },
      ],
      essential: true,
    });
  } else {
    questions.push({
      kind: "card_new",
      question: "Card details, once — I will remember it if you want.",
      options: [],
      essential: true,
    });
  }

  return {
    questions,
    companyId,
    cardId: cardIdChosen,
    extras: input.extras,
    extrasLine: extrasSentence(input.extras),
    fallback: input.passportRequired ? "passport" : null,
  };
}

export type SummaryInput = {
  /** "Milan", "Thu–Fri", "LOT 6:55", "Park Hyatt", "transfer" … */
  parts: string[];
  companyName: string | null;
  cardLabel: string | null;
  totalLabel: string;
};

/** The one closing line: everything decided, then the price, then the ask. */
export function summaryLine(input: SummaryInput): string {
  const parts = [...input.parts.filter((part) => part.trim().length > 0)];
  if (input.companyName) parts.push(`invoice to ${input.companyName}`);
  if (input.cardLabel) parts.push(input.cardLabel);
  return `${parts.join(", ")} — ${input.totalLabel}. Book it?`;
}

/** True when nothing at all is left to ask. */
export function nothingToAsk(closing: Closing): boolean {
  return closing.questions.length === 0;
}

export const savedCardLabel = cardLabel;
