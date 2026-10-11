import { createHash } from "node:crypto";
import {
  apiEnv,
  parseEnv,
  redirectEnv,
  webEnv,
  workerEnv,
} from "../packages/env/index";

export function devConfig(
  input: Record<string, string | undefined>,
  inherited: Record<string, string | undefined> = {},
) {
  const source = Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  const port = (key: string, fallback: number) => {
    const value = Number(inherited[key] || source[key] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535)
      throw new Error(`${key} must be a valid port.`);
    return value;
  };
  const ports = {
    web: port("DEV_WEB_PORT", 3000),
    redirect: port("DEV_REDIRECT_PORT", 3002),
    api: port("DEV_API_PORT", 3003),
    worker: port("DEV_WORKER_PORT", 3004),
  };
  if (new Set(Object.values(ports)).size !== 4)
    throw new Error("Dev service ports must be distinct.");
  const webOrigin = `http://localhost:${ports.web}`;
  const mongo =
    source.MONGODB_URL ||
    source.MONGODB_KEY ||
    "mongodb://127.0.0.1:27020/shortn_dev?replicaSet=rs0";
  const mongoUrl = new URL(mongo);
  const derive = (name: string) =>
    createHash("sha256")
      .update(`shortn:local-dev:${name}:`)
      .update(source.BETTER_AUTH_SECRET || "")
      .digest("hex");
  const warnings: string[] = [];
  const configured: Record<string, string> = { ...source };
  for (const provider of ["GITHUB", "GOOGLE"] as const) {
    const id = `AUTH_${provider}_ID` as const;
    const secret = `AUTH_${provider}_SECRET` as const;
    if (
      !webEnv.shape[id].safeParse(source[id] || undefined).success ||
      !webEnv.shape[secret].safeParse(source[secret] || undefined).success ||
      !source[id] ||
      !source[secret]
    ) {
      configured[id] = "";
      configured[secret] = "";
      warnings.push(
        `${provider} sign-in disabled: configure ${id} and ${secret} in .env.staging to enable it.`,
      );
    }
  }
  const storageKeys = [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ];
  const configuredStorage = storageKeys.some((key) => Boolean(source[key]));
  if (configuredStorage && !storageKeys.every((key) => Boolean(source[key])))
    throw new Error(
      `Incomplete S3 configuration: set ${storageKeys.filter((key) => !source[key]).join(", ")} in .env.staging.`,
    );
  const localStorage = configuredStorage
    ? {}
    : {
        S3_ENDPOINT: "http://127.0.0.1:19000",
        S3_REGION: "us-east-1",
        S3_BUCKET: "shortn-dev",
        S3_ACCESS_KEY_ID: "shortn-local",
        S3_SECRET_ACCESS_KEY: "shortn-local-development-secret",
      };
  const shared: Record<string, string> = {
    ...configured,
    ...localStorage,
    NODE_ENV: "development",
    MONGODB_URL: mongo,
    MONGODB_DB:
      source.MONGODB_DB ||
      decodeURIComponent(mongoUrl.pathname.slice(1)) ||
      "shortn_staging",
    REDIS_CACHE_URL: source.REDIS_CACHE_URL || "redis://127.0.0.1:16380",
    REDIS_DURABLE_URL: source.REDIS_DURABLE_URL || "redis://127.0.0.1:16379",
    BETTER_AUTH_URL: webOrigin,
    APP_URL: webOrigin,
    NEXT_PUBLIC_APP_URL: webOrigin,
    AUTH_URL: webOrigin,
    PUBLIC_ORIGIN: webOrigin,
    LINK_DOMAIN:
      source.LINK_DOMAIN ||
      new URL(
        source.NEXT_PUBLIC_APP_URL ||
          source.BETTER_AUTH_URL ||
          "https://staging.shortn.at",
      ).host,
    LEGACY_ORIGIN:
      source.LEGACY_ORIGIN ||
      source.NEXT_PUBLIC_APP_URL ||
      "https://staging.shortn.at",
    LEGACY_INTERNAL_SECRET:
      source.LEGACY_INTERNAL_SECRET || source.INTERNAL_API_SECRET || "",
    LINK_ACCESS_SECRET: source.LINK_ACCESS_SECRET || derive("link-access"),
    CONFIRMATION_TOKEN_SECRET:
      source.CONFIRMATION_TOKEN_SECRET || derive("confirmation"),
    IP_HASH_SECRET: source.IP_HASH_SECRET || derive("ip-hash"),
    POLAR_ENVIRONMENT: source.POLAR_ENVIRONMENT || "sandbox",
    WORKER_CONSUMER: `local-dev-${process.pid}`,
  };
  // Mask every runtime key so Next/Bun cannot fill a missing staging value
  // from apps/web/.env.local or a root .env.local.
  const schemas = {
    web: webEnv,
    redirect: redirectEnv,
    api: apiEnv,
    worker: workerEnv,
  };
  for (const schema of Object.values(schemas))
    for (const key of Object.keys(schema.shape)) shared[key] ??= "";
  for (const [name, schema] of Object.entries(schemas))
    parseEnv(schema, {
      ...shared,
      PORT: String(ports[name as keyof typeof ports]),
    });
  const infrastructure: string[] = [];
  const local = (value: string, port: number) => {
    const url = new URL(value);
    return (
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      Number(url.port || (url.protocol === "redis:" ? 6379 : 27017)) === port
    );
  };
  if (local(shared.REDIS_CACHE_URL!, 16380)) infrastructure.push("redis-cache");
  if (local(shared.REDIS_DURABLE_URL!, 16379))
    infrastructure.push("redis-durable");
  if (local(mongo, 27020)) infrastructure.push("mongo", "mongo-init");
  if (!configuredStorage) infrastructure.push("storage", "storage-init");
  return { shared, ports, warnings, infrastructure };
}
