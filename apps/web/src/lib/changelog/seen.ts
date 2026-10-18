import { readStored, writeStored, type StoreSource } from "@/lib/browser-store";

export const changelogSeenKey = "shortn:changelog-seen";

/**
 * `unavailable` means storage can't be read. The dashboard then neither opens
 * the dialog nor shows the dot: without a way to remember, it would nag on
 * every visit.
 */
export type SeenStatus = "seen" | "unseen" | "unavailable";

export function seenStatus(source: StoreSource, latestId: string): SeenStatus {
  const stored = readStored(source, changelogSeenKey);
  if (!stored.available) return "unavailable";
  return stored.value === latestId ? "seen" : "unseen";
}

export const markChangelogSeen = (source: StoreSource, id: string) =>
  writeStored(source, changelogSeenKey, id);

export interface AutoOpenContext {
  status: SeenStatus;
  impersonating: boolean;
  /** The tour is running or waiting to resume; the dialog would cover it. */
  tourActive: boolean;
}

/** The What's new dialog opens by itself only for a real, unseen release. */
export const shouldAutoOpen = ({
  status,
  impersonating,
  tourActive,
}: AutoOpenContext) => status === "unseen" && !impersonating && !tourActive;
