import { confirmMongoTarget } from "./cli-target";
import { closeMongoClient, getDb } from "./client";
import { syncIndexes } from "./indexes";
const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database)
  throw new Error("Set MONGODB_URL and MONGODB_DB explicitly");
confirmMongoTarget(url, database, process.argv.slice(2));
for (const arg of process.argv.slice(2))
  if (!["--dry-run", "--yes"].includes(arg))
    throw new Error(`Unknown argument: ${arg}`);
try {
  await syncIndexes(await getDb({ url, database }), {
    dryRun: process.argv.includes("--dry-run"),
  });
} finally {
  await closeMongoClient();
}
