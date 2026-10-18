import { useCallback, useSyncExternalStore } from "react";
import {
  applyThemePreference,
  isThemePreference,
  themeStorageKey,
  type ThemePreference,
} from "./theme";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const serverPreference = (): ThemePreference => "system";

export function useThemePreference() {
  const theme = useSyncExternalStore(
    subscribe,
    readPreference,
    serverPreference,
  );
  const setTheme = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(themeStorageKey, next);
    } catch {
      // Storage is blocked (private mode, policy): the choice lasts for this page only.
    }
    applyThemePreference(next);
    for (const listener of listeners) listener();
  }, []);
  return [theme, setTheme] as const;
}
