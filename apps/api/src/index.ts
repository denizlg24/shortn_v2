import { getDb, closeMongoClient } from "@shortn/db";
import { apiEnv, parseEnv } from "@shortn/env";
import { createApp } from "./app";
import { createRedisClients } from "@shortn/redis";

const env = parseEnv(apiEnv, process.env);
const db = await getDb({
  url: env.MONGODB_URL,
  database: env.MONGODB_DB,
  maxPoolSize: env.MONGODB_POOL_SIZE,
});
const log = (message: string, error?: unknown) =>
  error === undefined ? console.log(message) : console.error(message, error);

const redis =
  env.BIO_DELIVERY_ENABLED === "1"
    ? await createRedisClients({
        NODE_ENV: env.NODE_ENV,
        REDIS_CACHE_URL: env.REDIS_CACHE_URL!,
        REDIS_DURABLE_URL: env.REDIS_DURABLE_URL!,
      })
    : undefined;
const app = createApp({
  ...(redis && env.IP_HASH_SECRET && env.PUBLIC_ORIGIN
    ? {
        bioViews: {
          durable: redis.durable,
          secret: env.IP_HASH_SECRET,
          rootOrigin: env.PUBLIC_ORIGIN,
          webOrigin: env.BIO_WEB_ORIGIN,
          subdomains: env.BIO_SUBDOMAINS === "1",
        },
      }
    : {}),
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
  redis?.cache.disconnect();
  redis?.durable.disconnect();
  await server.stop();
  await closeMongoClient();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
