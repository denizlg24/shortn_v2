import type { Locale } from "@shortn/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { COPY, type Copy } from "./i18n";

export type Section =
  | "links"
  | "analytics"
  | "qr"
  | "bio"
  | "campaigns"
  | "domains"
  | "settings"
  | "gallery";
export type DemoState =
  "ready" | "empty" | "loading" | "error" | "readonly" | "long";
export type ThemePreference = "light" | "dark" | "system";

const SECTIONS: Section[] = [
  "links",
  "analytics",
  "qr",
  "bio",
  "campaigns",
  "domains",
  "settings",
  "gallery",
];
const DEMO_STATES: DemoState[] = [
  "ready",
  "empty",
  "loading",
  "error",
  "readonly",
  "long",
];

interface Route {
  section: Section;
  state: DemoState;
}

function parseHash(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const section = SECTIONS.find((candidate) => candidate === path) ?? "links";
  const state =
    DEMO_STATES.find((candidate) => candidate === params.get("state")) ??
    "ready";
  return { section, state };
}

const subscribeHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
const hashSnapshot = () => window.location.hash;

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribeScheme = (callback: () => void) => {
  const query = darkQuery();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

function initialPreference<T extends string>(
  param: string,
  storageKey: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const fromUrl = new URLSearchParams(window.location.search).get(param);
  const stored = fromUrl ?? window.localStorage.getItem(storageKey);
  return allowed.find((value) => value === stored) ?? fallback;
}

interface PlaygroundValue {
  route: Route;
  navigate: (section: Section, state?: DemoState) => void;
  setDemoState: (state: DemoState) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: Copy;
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

const PlaygroundContext = createContext<PlaygroundValue | null>(null);

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot);
  const route = useMemo(() => parseHash(hash), [hash]);
  const [locale, setLocaleState] = useState<Locale>(() =>
    initialPreference("lang", "shortn:locale", ["en", "pt"], "en"),
  );
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    initialPreference(
      "theme",
      "shortn:theme",
      ["light", "dark", "system"],
      "system",
    ),
  );
  const systemDark = useSyncExternalStore(
    subscribeScheme,
    () => darkQuery().matches,
  );
  const resolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-PT" : "en";
  }, [locale]);

  const navigate = useCallback((section: Section, state?: DemoState) => {
    const nextState =
      state ??
      (section === "links" ? parseHash(window.location.hash).state : "ready");
    window.location.hash = `/${section}${nextState === "ready" ? "" : `?state=${nextState}`}`;
  }, []);

  const value = useMemo<PlaygroundValue>(
    () => ({
      route,
      navigate,
      setDemoState: (state) => navigate("links", state),
      locale,
      setLocale: (next) => {
        window.localStorage.setItem("shortn:locale", next);
        setLocaleState(next);
      },
      copy: COPY[locale],
      theme,
      resolvedTheme,
      setTheme: (next) => {
        window.localStorage.setItem("shortn:theme", next);
        setThemeState(next);
      },
      shortcutsOpen,
      setShortcutsOpen,
      paletteOpen,
      setPaletteOpen,
    }),
    [route, navigate, locale, theme, resolvedTheme, shortcutsOpen, paletteOpen],
  );

  return (
    <PlaygroundContext.Provider value={value}>
      {children}
    </PlaygroundContext.Provider>
  );
}

export function usePlayground(): PlaygroundValue {
  const value = useContext(PlaygroundContext);
  if (!value)
    throw new Error("usePlayground must be used inside PlaygroundProvider");
  return value;
}
