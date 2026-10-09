import { recomputeRollups, utcDay } from "@shortn/core";
import { physicalNames, runMigrations } from "@shortn/db";
import type { Migration, MigrationState } from "@shortn/db";
import { keys } from "@shortn/redis";
import type { Redis } from "ioredis";
import type { Db, MongoClient, ObjectId } from "mongodb";
import { ingestGroup } from "./ingest";

export type TrimClient = Pick<Redis, "xinfo" | "xpending" | "xtrim">;

function field(reply: unknown[], name: string): unknown {
  const index = reply.indexOf(name);
  return index >= 0 ? reply[index + 1] : undefined;
}

function compareIds(a: string, b: string) {
  const [aMs = 0, aSeq = 0] = a.split("-").map(Number);
  const [bMs = 0, bSeq = 0] = b.split("-").map(Number);
  return aMs - bMs || aSeq - bSeq;
}

// XADD never trims, because MAXLEN would drop unprocessed clicks (04
// §Trimming). Entries older than both the group's last delivery and its
// oldest pending entry have been acknowledged and are safe to remove.
export async function trimStream(
  redis: TrimClient,
): Promise<string | undefined> {
  const groups = await redis
    .xinfo("GROUPS", keys.clicksStream)
    .catch((error: unknown) => {
      // Nothing to trim before the first click creates the stream.
      if (String(error).includes("no such key")) return [];
      throw error;
    });
  if (!Array.isArray(groups)) return undefined;
  const group = groups.find(
    (item): item is unknown[] =>
      Array.isArray(item) && field(item, "name") === ingestGroup,
  );
  if (!group) return undefined;
  const delivered = field(group, "last-delivered-id");
  if (typeof delivered !== "string" || delivered === "0-0") return undefined;
  const pending = await redis.xpending(keys.clicksStream, ingestGroup);
  const oldestPending =
    Array.isArray(pending) && typeof pending[1] === "string"
      ? pending[1]
      : undefined;
  const minId =
    oldestPending && compareIds(oldestPending, delivered) < 0
      ? oldestPending
      : delivered;
  await redis.xtrim(keys.clicksStream, "MINID", minId);
  return minId;
}

export async function refreshRecentRollups(db: Db, now = new Date()) {
  const from = utcDay(new Date(now.getTime() - 86_400_000));
  return recomputeRollups(db, from, now);
}

// Events written before their link had a workspace (M2 runs every minute).
export async function fillEventWorkspaces(db: Db) {
  const events = db.collection(physicalNames.click_events);
  const linkIds: (ObjectId | null)[] = await events.distinct("m.linkId", {
    "m.workspaceId": null,
    "m.linkId": { $ne: null },
  });
  const ids = linkIds.filter((id): id is ObjectId => id !== null);
  if (!ids.length) return 0;
  const links = await db
    .collection<{ _id: ObjectId; workspaceId?: ObjectId }>(physicalNames.links)
    .find(
      { _id: { $in: ids }, workspaceId: { $exists: true } },
      { projection: { workspaceId: 1 } },
    )
    .toArray();
  let filled = 0;
  for (const link of links) {
    if (!link.workspaceId) continue;
    const result = await events.updateMany(
      { "m.linkId": link._id, "m.workspaceId": null },
      { $set: { "m.workspaceId": link.workspaceId } },
    );
    filled += result.modifiedCount;
  }
  return filled;
}

// Continuous migrations keep derived fields in step with legacy writes. Only
// migrations an operator completed once are repeated here (13).
export async function runContinuousMigrations(
  client: MongoClient,
  db: Db,
  migrations: Migration[],
  log: (message: string) => void,
) {
  const continuous = migrations.filter((migration) => migration.continuous);
  if (!continuous.length) return [];
  // Completed once (it has a verify report) and not switched off. A run that
  // died with its container stays "running" or "failed" and is retried here.
  const applied = await db
    .collection<MigrationState>("_migrations")
    .find({
      _id: { $in: continuous.map((migration) => migration.id) },
      verifyReport: { $exists: true },
      status: { $nin: ["reverted", "paused"] },
    })
    .toArray();
  const ids = new Set(applied.map((state) => state._id));
  const selected = continuous.filter((migration) => ids.has(migration.id));
  if (!selected.length) return [];
  await runMigrations(client, db, selected, { log });
  return selected.map((migration) => migration.id);
}

export function every(
  ms: number,
  name: string,
  job: () => Promise<unknown>,
  log: (message: string, error?: unknown) => void,
) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (error) {
      log(`job ${name} failed`, error);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, ms);
}
