// Locks, suspends or restores a workspace until the admin console ships
// (doc 23 §3.2, phase A staging checks). Every run is recorded in
// admin_audit_log as actor "script".
//   MONGODB_URL=… MONGODB_DB=… REDIS_CACHE_URL=… \
//     bun scripts/workspace-suspension.ts --workspace <slug|id> \
//     --level locked|suspended|clear [--category abuse] --note "…" --yes
import {
  closeMongoClient,
  collection,
  confirmMongoTarget,
  getMongoClient,
  suspensionCategories,
} from "@shortn/db";
import { setWorkspaceSuspension } from "@shortn/core";
import { Redis } from "ioredis";
import { ObjectId } from "mongodb";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const target = option("--workspace");
const level = option("--level");
const note = option("--note");
const category = option("--category") ?? "other";
if (!target || !level || !note)
  throw new Error("--workspace, --level and --note are required");
if (level !== "locked" && level !== "suspended" && level !== "clear")
  throw new Error("--level must be locked, suspended or clear");
const parsedCategory = suspensionCategories.find((item) => item === category);
if (!parsedCategory)
  throw new Error(
    `--category must be one of ${suspensionCategories.join(", ")}`,
  );
if (!args.includes("--yes")) throw new Error("This writes; pass --yes");

const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database) throw new Error("Set MONGODB_URL and MONGODB_DB");
confirmMongoTarget(url, database, args);
const db = (await getMongoClient({ url, database })).db(database);
const redisUrl = process.env.REDIS_CACHE_URL;
if (!redisUrl)
  console.warn(
    "REDIS_CACHE_URL unset: redirect replicas pick the change up on their 30 s reload",
  );
const redis = redisUrl ? new Redis(redisUrl) : null;
try {
  const workspace = await collection(db, "workspaces").findOne(
    /^[a-f\d]{24}$/i.test(target)
      ? { _id: new ObjectId(target) }
      : { slug: target },
  );
  if (!workspace) throw new Error(`No workspace ${target}`);
  const at = new Date();
  const audit = await collection(db, "admin_audit_log").insertOne({
    _id: new ObjectId(),
    createdAt: at,
    actorId: "script",
    actorEmail: "script",
    action:
      level === "clear"
        ? "workspace.unsuspend"
        : `workspace.${level === "locked" ? "lock" : "suspend"}`,
    targetType: "workspace",
    targetId: workspace._id.toHexString(),
    workspaceId: workspace._id,
    status: "started",
    reason: note,
  });
  const result = await setWorkspaceSuspension(
    { db, cache: redis ?? { publish: async () => 0 } },
    workspace._id,
    level === "clear"
      ? null
      : {
          level,
          category: parsedCategory,
          internalNote: note,
          by: "script",
          at,
        },
  );
  await collection(db, "admin_audit_log").updateOne(
    { _id: audit.insertedId },
    {
      $set: result.ok
        ? {
            status: "succeeded",
            completedAt: new Date(),
            metadata: {
              before: result.value.before,
              after: result.value.after,
            },
          }
        : { status: "failed", completedAt: new Date(), error: result.error },
    },
  );
  if (!result.ok) throw new Error(result.error);
  console.log(
    `${workspace.slug}: ${result.value.before?.level ?? "active"} -> ${result.value.after?.level ?? "active"}`,
  );
} finally {
  redis?.disconnect();
  await closeMongoClient();
}
