/**
 * Light, dark, or whatever the device says.
 *
 * Three states rather than a switch, because "system" is the honest default:
 * someone who has told their phone to go dark at sunset has already answered
 * the question, and we should not make them answer it again here. Only an
 * explicit Light or Dark overrides it.
 *
 * The choice lives in this browser, next to the language and the cookie
 * choice. It is not an account setting and never follows anyone between
 * devices — a laptop in a bright office and a phone in a hotel room are
 * allowed to disagree.
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

/** What the traveller picked. "system" means "ask the device, every time". */
export type ThemeChoice = "light" | "dark" | "system";

/** What that actually resolves to right now. This is what paints the page. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "adair-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The two `theme-color` values, kept in step with `--background` in styles.css. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#FBF8F2",
  dark: "#171512",
};

export function isThemeChoice(value: string | null | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * The snippet that runs in the document head before React hydrates.
 *
 * It has to be a string of plain ES5 rather than something we import, because
 * this app is server-rendered: the markup arrives with no `dark` class on it,
 * and if we waited for the bundle a traveller on dark would get one
 * cream-coloured frame on every single page load. Keep it in step with
 * `applyTheme` below — the two do the same job at different moments.
 */
export const themeBootstrapScript = [
  "(function(){try{",
  `var c=localStorage.getItem("${THEME_STORAGE_KEY}");`,
  `var d=c==="dark"||(c!=="light"&&window.matchMedia("${DARK_QUERY}").matches);`,
  'document.documentElement.classList.toggle("dark",d);',
  "var m=document.querySelector('meta[name=\"theme-color\"]');",
  `if(m)m.setAttribute("content",d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}");`,
  "}catch(e){}})();",
].join("");

function readStoredChoice(): ThemeChoice | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(saved) ? saved : null;
  } catch {
    // Private browsing, or storage is blocked. Fall back to the device.
    return null;
  }
}

function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  // Keeps the browser chrome (mobile address bar, PWA splash) from staying
  // cream while the page underneath went dark.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (next: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The server has no device to ask, so the first render has to assume the
  // default and the mount effect corrects it. Nothing flashes while that
  // happens because `themeBootstrapScript` already painted the right colours.
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const stored = readStoredChoice();
    if (stored) setChoiceState(stored);
    setSystemDark(query.matches);
    setReady(true);

    // Someone on "system" whose phone flips to dark at sunset should see the
    // page follow it there and then, without a reload.
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    // Skipped until the effect above has read the browser, so we never undo
    // the bootstrap script's work for one frame on the way in.
    if (!ready) return;
    applyTheme(resolved);
  }, [ready, resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* nothing we can do; this browser simply asks the device again next time */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return value;
}
