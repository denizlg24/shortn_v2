import { getDb, closeMongoClient } from "@shortn/db";
import { apiEnv, parseEnv } from "@shortn/env";
import { createApp } from "./app";

const env = parseEnv(apiEnv, process.env);
const db = await getDb({
  url: env.MONGODB_URL,
  database: env.MONGODB_DB,
  maxPoolSize: env.MONGODB_POOL_SIZE,
});
const log = (message: string, error?: unknown) =>
  error === undefined ? console.log(message) : console.error(message, error);

const app = createApp({
  db,
  webhookSecret: env.POLAR_WEBHOOK_SECRET,
  log,
  async health() {
    try {
      await db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  },
});

const server = Bun.serve({
  port: env.PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
});
console.log(`api listening on ${server.port}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  await closeMongoClient();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
