/** Loopback-only P6 sandbox. No staging/prod data or provider writes. */
import { writeFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId } from "mongodb";
import { hashPassword } from "better-auth/crypto";
import { Redis } from "ioredis";
import {
  collection,
  legacyCollectionKeys,
  physicalNames,
  syncIndexes,
} from "@shortn/db";
import {
  createApiKey,
  ensurePersonalWorkspace,
  type ServiceContext,
} from "@shortn/core";
import { devConfig } from "../../../scripts/dev-config";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const secret = () => randomBytes(32).toString("hex");
const pepper = secret();
const { shared, ports } = devConfig({
  MONGODB_URL: "mongodb://127.0.0.1:27020/?directConnection=true",
  MONGODB_DB: "shortn_p6_dev",
  REDIS_CACHE_URL: "redis://127.0.0.1:16380/6",
  REDIS_DURABLE_URL: "redis://127.0.0.1:16379/6",
  BETTER_AUTH_SECRET: secret(),
  SSO_TRUSTED_ORIGINS: "http://localhost:3207,http://127.0.0.1:3207",
  LINK_ACCESS_SECRET: secret(),
  CONFIRMATION_TOKEN_SECRET: secret(),
  IP_HASH_SECRET: secret(),
  AUTH_SECRET: secret(),
  POLAR_ACCESS_TOKEN: secret(),
  POLAR_WEBHOOK_SECRET: secret(),
  POLAR_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "re_local_disabled",
  MAIL_ALLOWLIST: "nobody@shortn.invalid",
  API_KEY_PEPPER: pepper,
  PLATFORM_API_ENABLED: "1",
  PLATFORM_MCP_ENABLED: "1",
  QR_EXPORTS_ENABLED: "1",
  IMPORTS_ENABLED: "1",
  EXPORTS_ENABLED: "1",
  S3_ENDPOINT: "http://127.0.0.1:3205",
  S3_REGION: "local",
  S3_BUCKET: "synthetic-p6",
  S3_ACCESS_KEY_ID: "synthetic",
  S3_SECRET_ACCESS_KEY: "synthetic-local-secret",
  MCP_OAUTH_ENABLED: "1",
  MCP_PUBLIC_ORIGIN: "http://localhost:3203",
  MCP_OAUTH_ISSUER: "http://localhost:3200/api/auth",
  PLATFORM_WEBHOOKS_ENABLED: "1",
  WEBHOOK_SECRET_KEY: secret(),
  PLATFORM_API_ROLLOUT: "0",
  BILLING_WRITES: "0",
  DOMAIN_WRITES: "0",
  BIO_DELIVERY_ENABLED: "0",
  RUN_CONTINUOUS_MIGRATIONS: "0",
  LINK_DOMAIN: "shortn.invalid",
  DEV_WEB_PORT: "3200",
  DEV_API_PORT: "3203",
  DEV_REDIRECT_PORT: "3202",
  DEV_WORKER_PORT: "3204",
});
const client = await new MongoClient(shared.MONGODB_URL!).connect();
const db = client.db(shared.MONGODB_DB),
  cache = new Redis(shared.REDIS_CACHE_URL!);
const password = `Shortn-P6-${randomBytes(8).toString("hex")}!`,
  email = "p6@example.test",
  now = new Date();
try {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (item) => item.name,
    ),
  );
  for (const key of legacyCollectionKeys)
    if (!existing.has(physicalNames[key]))
      await db.createCollection(physicalNames[key]);
  await syncIndexes(db);
  // This sandbox rotates its auth secret on restart, so its encrypted signing
  // keys must rotate too. Only the forced loopback fixture database is touched.
  await db.collection(physicalNames.oauth_jwks).deleteMany({});
  const previous = await db.collection(physicalNames.user).findOne({ email });
  const userId = previous?._id ?? new ObjectId();
  await db.collection(physicalNames.user).updateOne(
    { _id: userId },
    {
      $set: {
        email,
        name: "P6 Platform",
        username: "p6platform",
        displayUsername: "p6platform",
        emailVerified: true,
        locale: "en",
        sub: "p6|local-demo",
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now, image: null },
    },
    { upsert: true },
  );
  await db.collection(physicalNames.account).updateOne(
    { userId, providerId: "credential" },
    {
      $set: {
        accountId: String(userId),
        password: await hashPassword(password),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  const workspace = await ensurePersonalWorkspace(db, {
    id: String(userId),
    name: "P6 Platform",
    email,
    username: "p6platform",
    sub: "p6|local-demo",
  });
  await collection(db, "workspaces").updateOne(
    { _id: workspace._id },
    { $set: { platformFeatures: { api: true, mcp: true, webhooks: true } } },
  );
  const ctx: ServiceContext = {
    db,
    workspace,
    actor: { userId: String(userId), role: "owner" },
    cache,
    linkDomain: shared.LINK_DOMAIN!,
  };
  const count = await collection(db, "api_keys").countDocuments({
    workspaceId: workspace._id,
  });
  for (let i = count; i < 60; i++) {
    const result = await createApiKey(
      ctx,
      {
        name:
          i === 59
            ? "Newsletter automation — São João, edición semanal — " +
              "integration ".repeat(4)
            : `Integration ${String(i + 1).padStart(3, "0")}`,
        scopes: ["links:read", "analytics:read"],
        ...(i % 4 === 0
          ? { ipAllowlist: ["192.0.2.0/24", "2001:db8::/32"] }
          : {}),
      },
      pepper,
    );
    if (!result.ok) throw new Error(result.error);
    if (i % 10 === 0)
      await collection(db, "api_keys").updateOne(
        { _id: new ObjectId(result.value.key.id) },
        { $set: { revokedAt: now } },
      );
  }
  await writeFile(
    "/tmp/shortn-p6-login.json",
    JSON.stringify(
      {
        email,
        password,
        workspace: workspace.slug,
        userId: String(userId),
        workspaceId: workspace._id.toHexString(),
        origin: "http://localhost:3200",
        api: "http://localhost:3203",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
} finally {
  cache.disconnect();
  await client.close();
}

const children: ChildProcess[] = [];
for (const name of ["web", "api", "redirect"] as const) {
  const child = spawn(
    name === "web" ? "node" : process.execPath,
    name === "web"
      ? [
          "--require",
          `${root}apps/web/scripts/p6-sso-dns.cjs`,
          "node_modules/next/dist/bin/next",
          "dev",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(ports.web),
        ]
      : ["--no-env-file", "--watch", "src/index.ts"],
    {
      cwd: `${root}apps/${name}`,
      env: {
        ...process.env,
        ...shared,
        SHORTN_NEXT_DIST_DIR: ".next/p6",
        SHORTN_P6_SSO_DNS: name === "web" ? "1" : "0",
        PORT: String(ports[name]),
      },
      stdio: "inherit",
      detached: true,
    },
  );
  children.push(child);
}
console.log(
  "P6 sandbox: http://localhost:3200/login; credentials in /tmp/shortn-p6-login.json",
);
function stop() {
  for (const child of children) {
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {
      /* Child already stopped. */
    }
  }
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (code) stop();
  });
