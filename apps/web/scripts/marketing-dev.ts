/**
 * Loopback-only marketing sandbox: web alone, with Cloudflare's always-pass
 * Turnstile test keys and the demo shortener on. `--prod` serves a production
 * build for Lighthouse. No staging/prod data or provider writes.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { devConfig } from "../../../scripts/dev-config";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const secret = () => randomBytes(32).toString("hex");
const production = process.argv.includes("--prod");
const { shared, ports } = devConfig({
  MONGODB_URL: "mongodb://127.0.0.1:27020/?directConnection=true",
  MONGODB_DB: "shortn_marketing_dev",
  REDIS_CACHE_URL: "redis://127.0.0.1:16380/7",
  REDIS_DURABLE_URL: "redis://127.0.0.1:16379/7",
  BETTER_AUTH_SECRET: secret(),
  LINK_ACCESS_SECRET: secret(),
  CONFIRMATION_TOKEN_SECRET: secret(),
  IP_HASH_SECRET: secret(),
  AUTH_SECRET: secret(),
  POLAR_ACCESS_TOKEN: secret(),
  POLAR_WEBHOOK_SECRET: secret(),
  POLAR_ENVIRONMENT: "sandbox",
  RESEND_API_KEY: "re_local_disabled",
  MAIL_ALLOWLIST: "nobody@shortn.invalid",
  BILLING_WRITES: "0",
  DOMAIN_WRITES: "0",
  BIO_DELIVERY_ENABLED: "0",
  RUN_CONTINUOUS_MIGRATIONS: "0",
  LINK_DOMAIN: "shortn.invalid",
  MARKETING_DEMO_ENABLED: "1",
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  DEV_WEB_PORT: "3400",
  DEV_API_PORT: "3403",
  DEV_REDIRECT_PORT: "3402",
  DEV_WORKER_PORT: "3404",
});

const env = {
  ...process.env,
  ...shared,
  ...(production ? { NODE_ENV: "production" } : {}),
  SHORTN_NEXT_DIST_DIR: ".next/marketing",
  PORT: String(ports.web),
};
const cwd = `${root}apps/web`;
if (production) {
  const build = spawnSync(
    "node",
    ["node_modules/next/dist/bin/next", "build"],
    {
      cwd,
      env,
      stdio: "inherit",
    },
  );
  if (build.status) process.exit(build.status);
}
const child = spawn(
  "node",
  [
    "node_modules/next/dist/bin/next",
    production ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(ports.web),
  ],
  { cwd, env, stdio: "inherit", detached: true },
);
console.log(`Marketing sandbox: http://localhost:${ports.web}/en`);
const stop = () => {
  try {
    process.kill(-child.pid!, "SIGTERM");
  } catch {
    /* Already stopped. */
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
