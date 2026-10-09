import { z } from "zod";

const value = (schema: z.ZodType, example: string, description: string) =>
  schema.meta({ example, description });
const url = (example: string, description: string) =>
  value(z.url(), example, description);
const secret = (description: string) =>
  value(
    z.string().min(32),
    "replace-with-a-distinct-secret-at-least-32-characters",
    description,
  );
const mongo = {
  MONGODB_URL: url(
    "mongodb://localhost:27017/shortn?replicaSet=rs0",
    "MongoDB replica set; use TLS and per-app credentials in production",
  ),
  MONGODB_DB: value(z.string().min(1), "shortn", "Database name"),
  MONGODB_POOL_SIZE: value(
    z.coerce.number().int().positive().default(20),
    "20",
    "Connection pool size per process",
  ),
};
const redis = {
  REDIS_CACHE_URL: url("redis://localhost:6380", "Evictable cache instance"),
  REDIS_DURABLE_URL: url(
    "redis://localhost:6379",
    "No-eviction streams and queues instance",
  ),
};
const common = {
  NODE_ENV: value(
    z.enum(["development", "test", "production"]).default("development"),
    "development",
    "Runtime environment",
  ),
  ...mongo,
  ...redis,
};
const r2 = {
  R2_ENDPOINT: url(
    "https://account-id.r2.cloudflarestorage.com",
    "R2 S3 endpoint",
  ),
  R2_ACCESS_KEY_ID: value(z.string().min(1), "replace-me", "R2 access key"),
  R2_SECRET_ACCESS_KEY: secret("R2 secret key"),
  R2_BUCKET: value(z.string().min(1), "shortn-assets", "R2 assets bucket"),
};
const billing = {
  POLAR_ACCESS_TOKEN: secret("Polar API token"),
  POLAR_WEBHOOK_SECRET: secret("Polar signature secret"),
};
const mail = {
  RESEND_API_KEY: value(z.string().min(1), "re_replace-me", "Resend API key"),
  CONFIRMATION_TOKEN_SECRET: secret("Email confirmation token secret"),
};
const security = {
  LINK_ACCESS_SECRET: secret("Link access token secret"),
  API_KEY_PEPPER: secret("API key hashing pepper"),
};
const cloudflare = {
  CF_API_TOKEN: secret("Cloudflare custom hostnames token"),
  CF_ZONE_ID: value(z.string().min(1), "replace-me", "Cloudflare zone ID"),
};
export const webEnv = z.object({
  ...common,
  ...r2,
  ...billing,
  ...mail,
  ...security,
  ...cloudflare,
  BETTER_AUTH_SECRET: secret("Authentication secret"),
  BETTER_AUTH_URL: url("http://localhost:3000", "Authentication origin"),
  PORT: value(
    z.coerce.number().int().min(1).max(65535).default(3000),
    "3000",
    "Web port",
  ),
});
export const redirectEnv = z.object({
  ...common,
  LINK_ACCESS_SECRET: security.LINK_ACCESS_SECRET,
  AUTH_SECRET: secret("Legacy JWT verification secret during M9 coexistence"),
  IP_HASH_SECRET: secret("Click IP HMAC secret"),
  PORT: value(
    z.coerce.number().int().min(1).max(65535).default(3002),
    "3002",
    "Redirect port",
  ),
});
export const apiEnv = z.object({
  ...common,
  ...r2,
  ...billing,
  ...mail,
  ...security,
  ...cloudflare,
  PORT: value(
    z.coerce.number().int().min(1).max(65535).default(3003),
    "3003",
    "API port",
  ),
});
export const workerEnv = z.object({
  ...common,
  ...r2,
  ...billing,
  ...mail,
  IP_HASH_SECRET: secret("Click IP HMAC secret"),
  MEILISEARCH_URL: url("http://localhost:7700", "Meilisearch origin"),
  MEILISEARCH_API_KEY: secret("Meilisearch key"),
});

export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
): z.output<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  throw new Error(
    `Invalid environment:\n${result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n")}`,
  );
}

export function envExample(): string {
  const sections = {
    web: webEnv,
    redirect: redirectEnv,
    api: apiEnv,
    worker: workerEnv,
  };
  const seen = new Set<string>();
  return Object.entries(sections)
    .map(([app, schema]) => {
      const entries = Object.entries(schema.shape).flatMap(([key, field]) => {
        if (seen.has(key)) return [];
        seen.add(key);
        const meta = field.meta();
        return [
          `# ${meta?.description ?? key}\n${key}=${String(meta?.example ?? "")}\n`,
        ];
      });
      return `# ${app} (also uses shared variables above)\n${entries.join("\n")}`;
    })
    .join("\n");
}
