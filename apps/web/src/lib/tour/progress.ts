import { readStored, writeStored, type StoreSource } from "@/lib/browser-store";

export const tourProgressKey = "shortn:tour";

/**
 * - `active`: a step is on screen in this tab.
 * - `paused`: left midway (skipped, closed, reloaded or navigated away);
 *   the menus offer to resume at `step`.
 * - `done`: finished once; the menus offer to take it again.
 */
export type TourProgress =
  | { status: "idle" }
  | { status: "active" | "paused"; step: number }
  | { status: "done" };

const idle: TourProgress = { status: "idle" };

export function parseProgress(raw: string | null, steps: number): TourProgress {
  if (!raw) return idle;
  if (raw === "done") return { status: "done" };
  const match = /^(active|paused):(\d{1,3})$/.exec(raw);
  if (!match) return idle;
  const step = Number(match[2]);
  if (step >= steps) return idle;
  return { status: match[1] === "active" ? "active" : "paused", step };
}

export function serializeProgress(progress: TourProgress): string | null {
  switch (progress.status) {
    case "idle":
      return null;
    case "done":
      return "done";
    default:
      return `${progress.status}:${progress.step}`;
  }
}

export function readProgress(source: StoreSource, steps: number): TourProgress {
  const stored = readStored(source, tourProgressKey);
  return stored.available ? parseProgress(stored.value, steps) : idle;
}

export const writeProgress = (source: StoreSource, progress: TourProgress) =>
  writeStored(source, tourProgressKey, serializeProgress(progress));

/** A tab that reloads or opens mid-tour doesn't pick the overlay back up on its own. */
export const progressOnLoad = (progress: TourProgress): TourProgress =>
  progress.status === "active"
    ? { status: "paused", step: progress.step }
    : progress;
