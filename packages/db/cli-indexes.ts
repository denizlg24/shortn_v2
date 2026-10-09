import { closeMongoClient, getDb } from "./client";
import { syncIndexes } from "./indexes";
const url = process.env.MONGODB_URL;
const database = process.env.MONGODB_DB;
if (!url || !database)
  throw new Error("Set MONGODB_URL and MONGODB_DB explicitly");
try {
  await syncIndexes(await getDb({ url, database }), {
    dryRun: process.argv.includes("--dry-run"),
  });
} finally {
  await closeMongoClient();
}
