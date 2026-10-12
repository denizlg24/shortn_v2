import { closeMongoClient, getMongoClient } from "@shortn/db";
import { productionMigrations } from "@shortn/db/migrations";
import { parseEnv, workerEnv } from "@shortn/env";
import { createPolar } from "@shortn/billing";
import { cloudflareDomains, pollDomains } from "@shortn/core";
import { deliverBioInvalidations } from "./bio-delivery";
import { sendDomainNotifications } from "./domain-notifications";
import { createRedisClients } from "@shortn/redis";
import { hostname } from "node:os";
import { createIngest } from "./ingest";
import { createMailer } from "@shortn/emails";
import { billingMailer, processBillingEvents, runReconcile } from "./billing";
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

const polar = env.POLAR_ACCESS_TOKEN
  ? createPolar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: env.POLAR_ENVIRONMENT,
    })
  : undefined;
const mailer = env.RESEND_API_KEY
  ? createMailer({
      apiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
      allowlist: env.MAIL_ALLOWLIST,
    })
  : undefined;
const billing = polar && {
  db,
  polar,
  server: env.POLAR_ENVIRONMENT,
  mode: env.BILLING_MODE,
  log,
  ...(mailer && env.APP_URL
    ? { onApplied: billingMailer({ db, mailer, appUrl: env.APP_URL, log }) }
    : {}),
};

const timers = [
  ...(env.DOMAIN_WRITES === "1" && mailer && env.APP_URL
    ? [
        every(
          60000,
          "domain-notifications",
          () => sendDomainNotifications(db, mailer, env.APP_URL!),
          log,
        ),
      ]
    : []),
  ...(env.DOMAIN_WRITES === "1" &&
  env.CLOUDFLARE_ZONE_ID &&
  env.CLOUDFLARE_API_TOKEN
    ? [
        every(
          60000,
          "domain-provisioning",
          () =>
            pollDomains(
              db,
              cloudflareDomains(
                env.CLOUDFLARE_ZONE_ID!,
                env.CLOUDFLARE_API_TOKEN!,
              ),
            ),
          log,
        ),
      ]
    : []),
  ...(env.BIO_DELIVERY_ENABLED === "1" &&
  env.BIO_WEB_ORIGIN &&
  env.BIO_INTERNAL_SECRET &&
  env.PUBLIC_ORIGIN
    ? [
        every(
          5000,
          "bio-invalidation",
          () =>
            deliverBioInvalidations(db, {
              webOrigin: env.BIO_WEB_ORIGIN!,
              secret: env.BIO_INTERNAL_SECRET!,
              rootOrigin: env.PUBLIC_ORIGIN!,
              subdomains: env.BIO_SUBDOMAINS === "1",
              zoneId: env.CLOUDFLARE_ZONE_ID,
              token: env.CLOUDFLARE_API_TOKEN,
            }),
          log,
        ),
      ]
    : []),
  ...(billing
    ? [
        every(
          5_000,
          "billing-events",
          () => processBillingEvents(billing),
          log,
        ),
        every(
          24 * 3_600_000,
          "billing-reconcile",
          () => runReconcile(billing),
          log,
        ),
      ]
    : []),
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
