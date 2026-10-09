import {
  closeMongoClient,
  getMongoClient,
  productionMigrations,
} from "@shortn/db";
import { parseEnv, workerEnv } from "@shortn/env";
import { createRedisClients } from "@shortn/redis";
import { hostname } from "node:os";
import { createIngest } from "./ingest";
import { createInvalidator } from "./invalidator";
import {
  every,
  fillEventWorkspaces,
  refreshRecentRollups,
  runContinuousMigrations,
  trimStream,
} from "./jobs";

const env = parseEnv(workerEnv, process.env);
const log = (message: string, error?: unknown) =>
  error === undefined ? console.log(message) : console.error(message, error);

const client = await getMongoClient({
  url: env.MONGODB_URL,
  database: env.MONGODB_DB,
  maxPoolSize: env.MONGODB_POOL_SIZE,
});
const db = client.db(env.MONGODB_DB);
const { cache, durable } = await createRedisClients(env);
// Blocking stream reads need a connection of their own.
const streamConnection = durable.duplicate();
await streamConnection.connect();

const ingest = createIngest({
  stream: streamConnection,
  db,
  ipSecret: env.IP_HASH_SECRET,
  consumer: env.WORKER_CONSUMER ?? hostname(),
  log,
});
const invalidator = createInvalidator({
  db,
  cache,
  tokens: durable,
  domain: env.LINK_DOMAIN,
  log,
});

const timers = [
  every(60_000, "trim", () => trimStream(durable), log),
  every(5 * 60_000, "rollups", () => refreshRecentRollups(db), log),
  every(5 * 60_000, "event-workspaces", () => fillEventWorkspaces(db), log),
  ...(env.RUN_CONTINUOUS_MIGRATIONS === "1"
    ? [
        every(
          60_000,
          "continuous-migrations",
          () =>
            runContinuousMigrations(client, db, productionMigrations, () => {}),
          log,
        ),
      ]
    : []),
];

const running = [ingest.run(), invalidator.run()];

const server = Bun.serve({
  port: env.PORT,
  hostname: "0.0.0.0",
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/__metrics")
      return Response.json({ ...ingest.stats, lastLoopAt: ingest.lastLoopAt });
    if (path !== "/__health") return new Response("Not found", { status: 404 });
    try {
      await Promise.all([
        cache.ping(),
        durable.ping(),
        db.command({ ping: 1 }),
      ]);
      if (Date.now() - ingest.lastLoopAt > 60_000)
        throw new Error("ingest stalled");
      return new Response("ok");
    } catch (error) {
      return new Response(String(error), { status: 503 });
    }
  },
});
log(`worker health on ${server.port}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const timer of timers) clearInterval(timer);
  ingest.stop();
  await invalidator.stop();
  // The current batch finishes and is acknowledged before exit.
  await Promise.race([Promise.allSettled(running), Bun.sleep(10_000)]);
  await server.stop();
  streamConnection.disconnect();
  cache.disconnect();
  durable.disconnect();
  await closeMongoClient();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
