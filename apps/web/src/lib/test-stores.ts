import type { KeyValueStore, StoreSource } from "./browser-store";

/** Test doubles for `browser-store`: a working store and the ways real ones fail. */
export function memorySource(): StoreSource {
  const data = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return () => store;
}

const denied = () => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

/** Every call throws, like a store whose quota is gone or access is revoked. */
const throwingStore: KeyValueStore = {
  getItem: denied,
  setItem: () => {
    throw new DOMException("Quota exceeded.", "QuotaExceededError");
  },
  removeItem: denied,
};

export const failingSources = [
  ["no window", () => undefined],
  ["storage blocked by policy", denied],
  ["store methods throw", () => throwingStore],
] as const satisfies readonly (readonly [string, StoreSource])[];
