"use client";

import { useCallback, useSyncExternalStore } from "react";
import { browserStore, createStoreSubscription } from "@/lib/browser-store";
import { latestEntry } from "./entries";
import {
  changelogSeenKey,
  markChangelogSeen,
  seenStatus,
  type SeenStatus,
} from "./seen";

const subscription = createStoreSubscription(changelogSeenKey);
const readStatus = () => seenStatus(browserStore, latestEntry.id);
// The server can't know; render as seen so nothing flashes before hydration.
const serverStatus = (): SeenStatus => "unavailable";

export function useChangelogSeen() {
  const status = useSyncExternalStore(
    subscription.subscribe,
    readStatus,
    serverStatus,
  );
  const markSeen = useCallback(() => {
    if (markChangelogSeen(browserStore, latestEntry.id)) subscription.notify();
  }, []);
  return { status, unseen: status === "unseen", markSeen };
}
