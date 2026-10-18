// Reattributes legacy QR scans that were recorded as clicks on the hidden
// backing link (doc 19, "Known legacy data issue"). Dry run by default.
//   MONGODB_URL=… MONGODB_DB=… bun scripts/reattribute-legacy-qr.ts [--json]
//   … --apply --yes [--settle-ms 15000] [--batch-size 1000]
//   … --verify <runId>
//   … --rollback <runId> --yes
// REDIS_CACHE_URL is optional: when set, touched link keys are invalidated
// directly instead of waiting for the worker's change-stream invalidator.
import {
  closeMongoClient,
  confirmMongoTarget,
  getMongoClient,
} from "@shortn/db";
import { invalidateLinks } from "@shortn/redis";
import { Redis } from "ioredis";
import {
  applyReattribution,
  buildPlan,
  formatPlan,
  formatVerify,
  isRunId,
  listRuns,
  rollbackReattribution,
  sampleDiffs,
  verifyRun,
} from "../src/legacy-qr-reattribution";

const args = process.argv.slice(2);
let mode: "dry-run" | "apply" | "verify" | "rollback" = "dry-run";
let runId: string | undefined;
let settleMs = 15_000;
let batchSize = 1000;
let json = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--yes") continue;
  else if (arg === "--dry-run") mode = "dry-run";
  else if (arg === "--apply") mode = "apply";
  else if (arg === "--json") json = true;
  else if (arg === "--verify" || arg === "--rollback") {
    mode = arg === "--verify" ? "verify" : "rollback";
    runId = args[++i];
    if (!runId || !isRunId(runId))
      throw new Error(`${arg} requires a run id (lqr-…)`);
  } else if (arg === "--settle-ms" || arg === "--batch-size") {
    const value = Number(args[++i]);
    if (!Number.isInteger(value) || value < 0)
      throw new Error(`${arg} requires a nonnegative integer`);
    if (arg === "--settle-ms") settleMs = value;
    else batchSize = value;
  } else throw new Error(`Unknown argument: ${arg}`);
}
if ((mode === "apply" || mode === "rollback") && !args.includes("--yes"))
  throw new Error(`--${mode} writes to the database and requires --yes`);

const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database)
  throw new Error("Set MONGODB_URL and MONGODB_DB explicitly");
confirmMongoTarget(url, database, args);
const linkDomain = process.env.LINK_DOMAIN ?? "shortn.at";
const log = (message: string) => console.error(message);
const print = (value: unknown, text: string) =>
  console.log(json ? JSON.stringify(value, null, 2) : text);

const redisUrl = process.env.REDIS_CACHE_URL;
const redis = redisUrl
  ? new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : undefined;
const invalidate = redis
  ? async (keys: string[]) => {
      if (redis.status === "wait") await redis.connect();
      for (let i = 0; i < keys.length; i += 500)
        await invalidateLinks(redis, linkDomain, keys.slice(i, i + 500));
      log(`invalidated ${keys.length} cached link keys`);
    }
  : undefined;

try {
  const client = await getMongoClient({ url, database });
  const db = client.db(database);
  const options = {
    client,
    db,
    linkDomain,
    batchSize,
    settleMs,
    log,
    ...(invalidate ? { invalidate } : {}),
  };
  if (mode === "dry-run") {
    const plan = await buildPlan(db);
    const [samples, runs] = await Promise.all([
      sampleDiffs(db, plan),
      listRuns(db),
    ]);
    print({ plan, runs }, formatPlan(plan, samples, runs));
  } else if (mode === "apply") {
    const result = await applyReattribution(options);
    if (!result.verify) print(result, "Nothing to reattribute.");
    else {
      print(
        result,
        formatVerify(`Run ${result.run?._id} verification`, result.verify),
      );
      if (!result.verify.ok) process.exitCode = 1;
    }
  } else if (mode === "verify" && runId) {
    const verify = await verifyRun(db, runId, linkDomain);
    print(verify, formatVerify(`Run ${runId} verification`, verify));
    if (!verify.ok) process.exitCode = 1;
  } else if (mode === "rollback" && runId) {
    const result = await rollbackReattribution({ ...options, runId });
    print(result, formatVerify(`Run ${runId} rollback`, result.verify));
    if (!result.verify.ok) process.exitCode = 1;
  }
} finally {
  redis?.disconnect();
  await closeMongoClient();
}
