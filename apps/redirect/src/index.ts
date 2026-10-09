import { encodeSecret } from "@shortn/core";
import { closeMongoClient, getDb } from "@shortn/db";
import { parseEnv, redirectEnv } from "@shortn/env";
import { createRedisClients, linkInvalidateChannel } from "@shortn/redis";
import { createApp } from "./app";
import { createClickQueue } from "./clicks";
import { metrics } from "./metrics";
import { createResolver, mongoLinkLoader, parseInvalidation } from "./resolver";

const env = parseEnv(redirectEnv, process.env);
const db = await getDb({
  url: env.MONGODB_URL,
  database: env.MONGODB_DB,
  maxPoolSize: env.MONGODB_POOL_SIZE,
});
const { cache, durable } = await createRedisClients(env);
const resolver = createResolver(cache, mongoLinkLoader(db));
metrics.gauge("l1_entries", () => resolver.memory.size);

const subscriber = cache.duplicate({ enableOfflineQueue: true });
subscriber.on("message", (channel, payload) => {
  if (channel !== linkInvalidateChannel) return;
  const message = parseInvalidation(payload);
  if (message) resolver.evict(message);
  else resolver.memory.clear();
});
// A dropped subscription can miss invalidations; the in-process layer is
// short-lived anyway, but clear it so reconnects never extend staleness.
subscriber.on("ready", () => resolver.memory.clear());
await subscriber.subscribe(linkInvalidateChannel);

const clicks = createClickQueue(durable, env.CLICK_SPOOL_PATH);
await clicks.load();
const drainTimer = setInterval(() => {
  if (clicks.spooled) void clicks.drain();
}, 1000);

let healthy = { at: 0, ok: false };
const health = async () => {
  if (Date.now() - healthy.at < 5000) return healthy.ok;
  try {
    await Promise.all([cache.ping(), durable.ping(), db.command({ ping: 1 })]);
    healthy = { at: Date.now(), ok: true };
  } catch {
    healthy = { at: Date.now(), ok: false };
  }
  return healthy.ok;
};

const app = createApp({
  resolver,
  enqueue: clicks.enqueue,
  health,
  secrets: {
    legacy: encodeSecret(env.AUTH_SECRET),
    linkAccess: env.LINK_ACCESS_SECRET
      ? encodeSecret(env.LINK_ACCESS_SECRET)
      : undefined,
    confirmation: env.CONFIRMATION_TOKEN_SECRET
      ? encodeSecret(env.CONFIRMATION_TOKEN_SECRET)
      : undefined,
  },
  origin: new URL(env.PUBLIC_ORIGIN).origin,
  linkDomain: env.LINK_DOMAIN,
  edgeAuthSecret: env.EDGE_AUTH_SECRET,
  log: (message, error) => console.error(message, error),
});

const server = Bun.serve({
  port: env.PORT,
  hostname: "0.0.0.0",
  reusePort: true,
  fetch: app.fetch,
});
console.log(`redirect listening on ${server.port}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(drainTimer);
  await server.stop();
  await clicks.drain();
  if (clicks.spooled)
    console.error(`exiting with ${clicks.spooled} spooled clicks`);
  subscriber.disconnect();
  cache.disconnect();
  durable.disconnect();
  await closeMongoClient();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
