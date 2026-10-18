import { getDb, closeMongoClient } from "@shortn/db";
import { apiEnv, parseEnv } from "@shortn/env";
import { createApp } from "./app";
import { createRedisClients } from "@shortn/redis";
import { createObjectStore } from "@shortn/storage";
import { clientIp } from "./client-ip";

const env = parseEnv(apiEnv, process.env);
const qrExports =
  env.QR_EXPORTS_ENABLED === "1"
    ? createObjectStore({
        S3_ENDPOINT: env.S3_ENDPOINT!,
        S3_REGION: env.S3_REGION!,
        S3_BUCKET: env.S3_BUCKET!,
        S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID!,
        S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY!,
      })
    : undefined;
const db = await getDb({
  url: env.MONGODB_URL,
  database: env.MONGODB_DB,
  maxPoolSize: env.MONGODB_POOL_SIZE,
});
const log = (message: string, error?: unknown) =>
  error === undefined ? console.log(message) : console.error(message, error);

const redis =
  env.BIO_DELIVERY_ENABLED === "1" ||
  env.PLATFORM_API_ENABLED === "1" ||
  env.PLATFORM_MCP_ENABLED === "1"
    ? await createRedisClients({
        NODE_ENV: env.NODE_ENV,
        REDIS_CACHE_URL: env.REDIS_CACHE_URL!,
        REDIS_DURABLE_URL: env.REDIS_DURABLE_URL!,
      })
    : undefined;
const app = createApp({
  ...(redis &&
  env.PLATFORM_MCP_ENABLED === "1" &&
  env.API_KEY_PEPPER &&
  env.MCP_PUBLIC_ORIGIN
    ? {
        mcp: {
          ...(qrExports ? { qrExports } : {}),
          cache: redis.cache,
          pepper: env.API_KEY_PEPPER,
          linkDomain: env.LINK_DOMAIN,
          origin: env.MCP_PUBLIC_ORIGIN,
          rolloutPercent: env.PLATFORM_MCP_ROLLOUT,
          ...(env.MCP_OAUTH_ENABLED === "1" && env.MCP_OAUTH_ISSUER
            ? { oauth: { issuer: env.MCP_OAUTH_ISSUER } }
            : {}),
          clientIp: (request: Request) =>
            clientIp(
              request,
              server.requestIP(request)?.address,
              env.API_EDGE_AUTH_SECRET,
            ),
        },
      }
    : {}),
  ...(redis &&
  env.BIO_DELIVERY_ENABLED === "1" &&
  env.IP_HASH_SECRET &&
  env.PUBLIC_ORIGIN
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
  ...(redis && env.PLATFORM_API_ENABLED === "1" && env.API_KEY_PEPPER
    ? {
        rest: {
          ...(qrExports ? { qrExports } : {}),
          cache: redis.cache,
          durable: redis.durable,
          pepper: env.API_KEY_PEPPER,
          linkDomain: env.LINK_DOMAIN,
          rolloutPercent: env.PLATFORM_API_ROLLOUT,
          domainWrites: env.DOMAIN_WRITES === "1",
          webhooksEnabled: env.PLATFORM_WEBHOOKS_ENABLED === "1",
          webhooksRolloutPercent: env.PLATFORM_WEBHOOKS_ROLLOUT,
          ...(env.WEBHOOK_SECRET_KEY
            ? { webhookSecretKey: env.WEBHOOK_SECRET_KEY }
            : {}),
          clientIp: (request: Request): string | undefined =>
            clientIp(
              request,
              server.requestIP(request)?.address,
              env.API_EDGE_AUTH_SECRET,
            ),
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
