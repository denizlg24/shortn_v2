import { collection } from "@shortn/db";
import type { WorkspaceSuspensionMessage } from "@shortn/redis";
import type { Db } from "mongodb";

export interface SuspendedWorkspaces {
  has(workspaceId: string): boolean;
}

/** In-process set of suspended workspaces, so the hot path checks a link's
 * workspace without I/O (23 §3.2). It fails open: until the first load
 * succeeds every workspace counts as active, and a redirect never fails on
 * account of suspension state. */
export function createSuspensionSet(
  load: () => Promise<Iterable<string>>,
  options: {
    refreshMs?: number;
    retryMs?: number;
    log?: (message: string, error?: unknown) => void;
  } = {},
) {
  const refreshMs = options.refreshMs ?? 30_000,
    retryMs = options.retryMs ?? 5_000,
    log = options.log ?? console.error;
  let ids = new Set<string>();
  let loaded = false;
  // Messages that arrive while a reload is in flight would otherwise be
  // overwritten by the older snapshot.
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  async function reload() {
    const started = generation;
    try {
      const next = new Set(await load());
      if (started === generation) ids = next;
      loaded = true;
      return true;
    } catch (error) {
      log("suspended workspace load failed", error);
      return false;
    }
  }
  function schedule(ms: number) {
    if (stopped) return;
    timer = setTimeout(async () => {
      schedule((await reload()) ? refreshMs : retryMs);
    }, ms);
    timer.unref?.();
  }
  return {
    has: (workspaceId: string) => ids.has(workspaceId),
    get loaded() {
      return loaded;
    },
    get size() {
      return ids.size;
    },
    apply(message: WorkspaceSuspensionMessage) {
      generation++;
      if (message.suspended) ids.add(message.workspaceId);
      else ids.delete(message.workspaceId);
    },
    reload,
    async start() {
      schedule((await reload()) ? refreshMs : retryMs);
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

export async function loadSuspendedWorkspaces(db: Db) {
  const rows = await collection(db, "workspaces")
    .find({ "suspension.level": "suspended" }, { projection: { _id: 1 } })
    .toArray();
  return rows.map((row) => row._id.toHexString());
}
