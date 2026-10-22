"use client";

import { useSyncExternalStore } from "react";

// Selections span pages and filters (23 §2.0), so they live in this tab's
// sessionStorage, keyed per list, and bulk action pages read them back.
const prefix = "shortn-admin-selection:";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; ids: string[] }>();
const empty: string[] = [];

export function readSelection(key: string): string[] {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(prefix + key);
  } catch {
    return empty;
  }
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.ids;
  let ids = empty;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed))
      ids = parsed.filter((id): id is string => typeof id === "string");
  } catch {
    ids = empty;
  }
  cache.set(key, { raw, ids });
  return ids;
}

export function writeSelection(key: string, ids: string[]) {
  try {
    if (ids.length)
      sessionStorage.setItem(prefix + key, JSON.stringify([...new Set(ids)]));
    else sessionStorage.removeItem(prefix + key);
  } catch {
    // Private mode: selection works for this page only.
  }
  for (const listener of listeners) listener();
}

export function useSelection(key: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => readSelection(key),
    () => empty,
  );
}
