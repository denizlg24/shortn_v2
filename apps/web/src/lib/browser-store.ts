/**
 * localStorage that never throws. Private browsing, storage policies and
 * sandboxed frames can make even `window.localStorage` itself throw, so every
 * access goes through here and degrades to "unavailable".
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StoreSource = () => KeyValueStore | undefined;

export const browserStore: StoreSource = () =>
  typeof window === "undefined" ? undefined : window.localStorage;

export type StoredValue =
  { available: true; value: string | null } | { available: false };

export function readStored(source: StoreSource, key: string): StoredValue {
  try {
    const store = source();
    if (!store) return { available: false };
    return { available: true, value: store.getItem(key) };
  } catch {
    return { available: false };
  }
}

/** Returns whether the value was persisted. */
export function writeStored(
  source: StoreSource,
  key: string,
  value: string | null,
): boolean {
  try {
    const store = source();
    if (!store) return false;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Same-tab listeners plus `storage` events from other tabs, for useSyncExternalStore. */
export function createStoreSubscription(key: string) {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener();
      };
      listeners.add(listener);
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
}
