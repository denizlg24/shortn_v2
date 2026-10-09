import { closeMongoClient, getMongoClient } from "../client";
import { runMigrations } from "./runner";
import type { Migration, RunnerOptions } from "./runner";
// Production data migrations land in subsequent phases. Test fixtures are never registered here.
const migrations: Migration[] = [];
const args = process.argv.slice(2);
const options: RunnerOptions = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--dry-run") options.dryRun = true;
  else if (arg === "--verify-only") options.verifyOnly = true;
  else if (arg === "--confirm-contract") options.confirmContract = true;
  else if (arg === "--down") options.direction = "down";
  else if (arg === "--until") {
    const id = args[++i];
    if (!id) throw new Error("--until requires an id");
    options.until = id;
  } else if (arg === "--batch-size" || arg === "--batch-delay-ms") {
    const number = Number(args[++i]);
    if (!Number.isInteger(number))
      throw new Error(`${arg} requires an integer`);
    if (arg === "--batch-size") options.batchSize = number;
    else options.batchDelayMs = number;
  } else throw new Error(`Unknown argument: ${arg}`);
}
if (!migrations.length) console.log("No production migrations registered yet");
else {
  const url = process.env.MONGODB_URL;
  const database = process.env.MONGODB_DB;
  if (!url || !database)
    throw new Error("Set MONGODB_URL and MONGODB_DB explicitly");
  try {
    const client = await getMongoClient({ url, database });
    await runMigrations(client, client.db(database), migrations, options);
  } finally {
    await closeMongoClient();
  }
}
