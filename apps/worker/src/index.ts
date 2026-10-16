import { createWorkspaceExportWorker } from "./workspace-exports";
import { createAnalyticsExportWorker } from "./analytics-exports";
import { createLinkExportWorker } from "./link-exports";
import { createImportWorker } from "./imports";
import { createHealthWorker } from "./link-health";
import { createLinkMetadataWorker } from "./link-metadata";
import { createQrExportWorker } from "./qr-exports";
import { createObjectStore } from "@shortn/storage";
import { closeMongoClient, getMongoClient } from "@shortn/db";
import { productionMigrations } from "@shortn/db/migrations";
import { parseEnv, workerEnv } from "@shortn/env";
import { createPolar } from "@shortn/billing";
import {
  cloudflareDomains,
  pollDomains,
  purgeExpiredLinks,
} from "@shortn/core";
import { createRuleScheduleWorker } from "./rule-schedules";
import { createSafetyWorker } from "./safety-scans";
import { createWebhookWorker } from "./outgoing-webhooks";
import { deliverBioInvalidations } from "./bio-delivery";
import { sendWebhookNotifications } from "./webhook-notifications";
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
  webhooks: {
    enabled: env.PLATFORM_WEBHOOKS_ENABLED === "1",
    rolloutPercent: env.PLATFORM_WEBHOOKS_ROLLOUT,
  },
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

const outgoingWebhooks =
  env.PLATFORM_WEBHOOKS_ENABLED === "1"
    ? createWebhookWorker({
        db,
        durable,
        config: {
          enabled: true,
          secretKey: env.WEBHOOK_SECRET_KEY!,
          rolloutPercent: env.PLATFORM_WEBHOOKS_ROLLOUT,
        },
        log,
      })
    : undefined;

const safetyScans = createSafetyWorker({
  db,
  cache,
  durable,
  linkDomain: env.LINK_DOMAIN,
  provider: { webRiskApiKey: env.WEB_RISK_API_KEY },
  log,
});

const ruleSchedules = createRuleScheduleWorker({
  db,
  cache,
  durable,
  linkDomain: env.LINK_DOMAIN,
  log,
});

const linkHealth = createHealthWorker({ db, durable, log });
const linkMetadata = await createLinkMetadataWorker(db);
const qrExports =
  env.QR_EXPORTS_ENABLED === "1"
    ? createQrExportWorker({
        db,
        durable,
        log,
        linkDomain: env.LINK_DOMAIN,
        logoOrigins: [env.APP_URL!, env.PUBLIC_ORIGIN]
          .filter((value): value is string => Boolean(value))
          .map((value) => new URL(value).origin),
        store: createObjectStore({
          S3_ENDPOINT: env.S3_ENDPOINT!,
          S3_REGION: env.S3_REGION!,
          S3_BUCKET: env.S3_BUCKET!,
          S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
          S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
        }),
      })
    : undefined;

const imports =
  env.IMPORTS_ENABLED === "1"
    ? createImportWorker({
        db,
        cache,
        durable,
        log,
        linkDomain: env.LINK_DOMAIN,
        store: createObjectStore({
          S3_ENDPOINT: env.S3_ENDPOINT!,
          S3_REGION: env.S3_REGION!,
          S3_BUCKET: env.S3_BUCKET!,
          S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
          S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
        }),
      })
    : undefined;

const linkExports =
  env.EXPORTS_ENABLED === "1"
    ? createLinkExportWorker({
        db,
        cache,
        durable,
        log,
        linkDomain: env.LINK_DOMAIN,
        store: createObjectStore({
          S3_ENDPOINT: env.S3_ENDPOINT!,
          S3_REGION: env.S3_REGION!,
          S3_BUCKET: env.S3_BUCKET!,
          S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
          S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
        }),
      })
    : undefined;

const analyticsExports =
  env.EXPORTS_ENABLED === "1"
    ? createAnalyticsExportWorker({
        db,
        cache,
        durable,
        log,
        linkDomain: env.LINK_DOMAIN,
        store: createObjectStore({
          S3_ENDPOINT: env.S3_ENDPOINT!,
          S3_REGION: env.S3_REGION!,
          S3_BUCKET: env.S3_BUCKET!,
          S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
          S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
        }),
      })
    : undefined;

const workspaceExports =
  env.EXPORTS_ENABLED === "1"
    ? createWorkspaceExportWorker({
        db,
        cache,
        durable,
        log,
        linkDomain: env.LINK_DOMAIN,
        appUrl: env.APP_URL!,
        ...(mailer ? { mailer } : {}),
        store: createObjectStore({
          S3_ENDPOINT: env.S3_ENDPOINT!,
          S3_REGION: env.S3_REGION!,
          S3_BUCKET: env.S3_BUCKET!,
          S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
          S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
        }),
      })
    : undefined;

const timers = [
  every(1000, "link-metadata", () => linkMetadata.pump(), log),
  ...(workspaceExports
    ? [every(1000, "workspace-exports", () => workspaceExports.pump(), log)]
    : []),
  ...(analyticsExports
    ? [every(1000, "analytics-exports", () => analyticsExports.pump(), log)]
    : []),
  ...(linkExports
    ? [every(1000, "link-exports", () => linkExports.pump(), log)]
    : []),
  ...(imports ? [every(1000, "imports", () => imports.pump(), log)] : []),
  ...(qrExports
    ? [every(1000, "qr-exports", () => qrExports.pump(), log)]
    : []),
  every(5000, "link-health", () => linkHealth.pump(), log),
  every(1000, "rule-schedules", () => ruleSchedules.pump(), log),
  every(5000, "safety-scans", () => safetyScans.pump(), log),
  ...(outgoingWebhooks && mailer && env.APP_URL
    ? [
        every(
          60000,
          "webhook-notifications",
          () => sendWebhookNotifications(db, mailer, env.APP_URL!),
          log,
        ),
      ]
    : []),
  ...(outgoingWebhooks
    ? [every(1000, "outgoing-webhooks", () => outgoingWebhooks.pump(), log)]
    : []),
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
  every(
    60_000,
    "link-trash",
    () => purgeExpiredLinks({ db, cache, linkDomain: env.LINK_DOMAIN }),
    log,
  ),
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
  await outgoingWebhooks?.close();
  await safetyScans.close();
  await linkHealth.close();
  await linkMetadata.close();
  await qrExports?.close();
  await imports?.close();
  await linkExports?.close();
  await analyticsExports?.close();
  await workspaceExports?.close();
  await ruleSchedules.close();
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
