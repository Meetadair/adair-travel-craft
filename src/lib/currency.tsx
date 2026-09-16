/**
 * The currency prices are shown in — never what a supplier actually charges.
 * A flight quoted in GBP and a hotel quoted in USD both still settle in
 * their own currency; this only changes the number printed on screen, via
 * the live EUR-anchored rates in fx.server.ts.
 *
 * Lives in this browser, the same way the theme choice does: it is not an
 * account setting that has to agree across every device someone owns. It is
 * still written through to `profiles.currency` (best-effort, signed-in only)
 * so another surface — an email, an invoice summary — can read it later.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getFxRates } from "@/lib/currency.functions";
import { convertAmount } from "@/lib/trip/currency-math";

export const CURRENCY_STORAGE_KEY = "adair-currency";

/** Shown until the live table loads — same fallback fx.server.ts starts from. */
const FALLBACK_CURRENCIES = [
  "EUR", "USD", "GBP", "PLN", "CHF", "SEK", "NOK", "DKK", "CZK", "JPY",
];

function readStoredCurrency(): string | null {
  try {
    const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return saved && saved.length === 3 ? saved.toUpperCase() : null;
  } catch {
    return null;
  }
}

type CurrencyContextValue = {
  /** The traveller's chosen display currency, e.g. "EUR", "USD". */
  code: string;
  setCode: (next: string) => void;
  /** Every currency worth offering in the picker. */
  currencies: string[];
  /** Converts an amount quoted in `from` into the display currency. */
  convert: (amount: number, from: string) => number;
  /** Converts and formats in one step, with the display currency's own symbol. */
  format: (amount: number, from: string, locale?: string) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCodeState] = useState("EUR");

  useEffect(() => {
    const stored = readStoredCurrency();
    if (stored) setCodeState(stored);
  }, []);

  const fetchRates = useServerFn(getFxRates);
  const ratesQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: () => fetchRates(),
    staleTime: 60 * 60_000,
    gcTime: 6 * 60 * 60_000,
  });
  const rates = ratesQuery.data?.rates ?? {};
  const currencies = ratesQuery.data?.currencies ?? FALLBACK_CURRENCIES;

  const setCode = useCallback((next: string) => {
    const upper = next.toUpperCase();
    setCodeState(upper);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, upper);
    } catch {
      /* private browsing — they will pick again next visit */
    }
    // Best-effort: a signed-out traveller, or a save that fails, changes
    // nothing about what they see right now.
    void import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        void import("@/lib/account.functions").then(({ setPreferredCurrency }) =>
          setPreferredCurrency({ data: { currency: upper } }).catch(() => {}),
        );
      }),
    );
  }, []);

  const convert = useCallback(
    (amount: number, from: string) => convertAmount(amount, from, code, rates),
    [code, rates],
  );

  const format = useCallback(
    (amount: number, from: string, locale = "en-US") => {
      const converted = convert(amount, from);
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: code,
          maximumFractionDigits: converted >= 100 ? 0 : 2,
        }).format(converted);
      } catch {
        return `${converted.toLocaleString(locale, { maximumFractionDigits: 0 })} ${code}`;
      }
    },
    [code, convert],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ code, setCode, currencies, convert, format }),
    [code, setCode, currencies, convert, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used inside <CurrencyProvider>.");
  return value;
}
