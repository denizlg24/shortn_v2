import { z } from "zod";

const value = <S extends z.ZodType>(
  schema: S,
  example: string,
  description: string,
) => schema.meta({ example, description });
const url = (example: string, description: string) =>
  value(z.url(), example, description);
const httpUrl = (example: string, description: string) =>
  value(z.httpUrl(), example, description);
const secret = (description: string) =>
  value(
    z
      .string()
      .min(32)
      .refine(
        (value) =>
          !/replace[-_ ]|placeholder|change[-_ ]?me|your[-_ ](?:secret|token)/i.test(
            value,
          ) && new Set(value).size > 1,
        "Use a real secret, not a placeholder",
      ),
    "replace-with-a-distinct-secret-at-least-32-characters",
    description,
  );
const mongo = {
  MONGODB_URL: url(
    "mongodb://localhost:27017/shortn?replicaSet=rs0",
    "MongoDB replica set; use TLS and per-app credentials in production",
  ),
  MONGODB_PHYSICAL_NAMES: value(
    z
      .string()
      .refine((value) => {
        try {
          return z
            .record(z.string(), z.string().min(1))
            .safeParse(JSON.parse(value)).success;
        } catch {
          return false;
        }
      }, "Expected a JSON collection-name map")
      .optional(),
    "{}",
    "Optional audited physical collection-name overrides",
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
const productionRules = (
  env: Record<string, unknown>,
  ctx: z.RefinementCtx,
) => {
  if (env.NODE_ENV !== "production") return;
  if (env.REDIS_CACHE_URL === env.REDIS_DURABLE_URL)
    ctx.addIssue({
      code: "custom",
      path: ["REDIS_DURABLE_URL"],
      message: "Production Redis URLs must differ",
    });
  const seen = new Set<string>();
  for (const [key, item] of Object.entries(env)) {
    if (
      !/(SECRET|TOKEN|PEPPER|API_KEY)$|^R2_SECRET_ACCESS_KEY$/.test(key) ||
      typeof item !== "string"
    )
      continue;
    if (seen.has(item))
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Production secrets must be distinct",
      });
    seen.add(item);
  }
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
  R2_ENDPOINT: httpUrl(
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
  RESEND_API_KEY: value(
    z
      .string()
      .min(1)
      .refine(
        (value) => !/replace[-_ ]|placeholder|change[-_ ]?me/i.test(value),
        "Use a real API key, not a placeholder",
      ),
    "re_replace-me",
    "Resend API key",
  ),
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
export const webEnv = z
  .object({
    ...common,
    ...r2,
    ...billing,
    ...mail,
    ...security,
    ...cloudflare,
    BETTER_AUTH_SECRET: secret("Authentication secret"),
    BETTER_AUTH_URL: httpUrl("http://localhost:3000", "Authentication origin"),
    PORT: value(
      z.coerce.number().int().min(1).max(65535).default(3000),
      "3000",
      "Web port",
    ),
  })
  .superRefine(productionRules);
export const redirectEnv = z
  .object({
    ...common,
    // Optional until the new web app mints link-access cookies (02 M9).
    LINK_ACCESS_SECRET: security.LINK_ACCESS_SECRET.optional(),
    CONFIRMATION_TOKEN_SECRET: mail.CONFIRMATION_TOKEN_SECRET.optional(),
    // Legacy's value, verified as-is; its length isn't ours to choose.
    AUTH_SECRET: value(
      z.string().min(1),
      "legacy-auth-secret",
      "Legacy JWT verification secret during M9 coexistence",
    ),
    PUBLIC_ORIGIN: httpUrl(
      "http://localhost:3000",
      "Public origin for safety, authenticate and not-found redirects",
    ),
    LINK_DOMAIN: value(
      z.string().min(1).default("shortn.at"),
      "shortn.at",
      "Domain that stored link keys belong to",
    ),
    EDGE_AUTH_SECRET: secret(
      "Shared secret the edge Worker sends as X-Edge-Auth; required when set",
    ).optional(),
    CLICK_SPOOL_PATH: value(
      z.string().min(1).default("/tmp/shortn-click-spool.ndjson"),
      "/tmp/shortn-click-spool.ndjson",
      "Local spool for click events while Redis is unreachable",
    ),
    PORT: value(
      z.coerce.number().int().min(1).max(65535).default(3002),
      "3002",
      "Redirect port",
    ),
  })
  .superRefine(productionRules);
export const apiEnv = z
  .object({
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
  })
  .superRefine(productionRules);
export const workerEnv = z
  .object({
    ...common,
    IP_HASH_SECRET: secret("Click IP HMAC secret"),
    LINK_DOMAIN: redirectEnv.shape.LINK_DOMAIN,
    PORT: value(
      z.coerce.number().int().min(1).max(65535).default(3004),
      "3004",
      "Worker health endpoint port",
    ),
    WORKER_CONSUMER: value(
      z.string().min(1).optional(),
      "worker-1",
      "Stream consumer name; defaults to the hostname",
    ),
    RUN_CONTINUOUS_MIGRATIONS: value(
      z.enum(["0", "1"]).default("1"),
      "1",
      "Run continuous expand migrations every minute",
    ),
  })
  .superRefine(productionRules);

// Legacy infrastructure variables also belong in the generated root example.
// The legacy app validates its complete runtime environment in utils/env.ts.
export const legacyInfraEnv = z.object({
  PICRON_URL: value(
    z.url().default("https://picron.denizlg24.com"),
    "https://picron.denizlg24.com",
    "Self-hosted PiCron origin",
  ),
  PICRON_USERNAME: value(z.string().min(1), "replace-me", "PiCron username"),
  PICRON_PASSWORD: value(z.string().min(1), "replace-me", "PiCron password"),
  S3_ENDPOINT: url(
    "https://api.denizlg24.com/v2",
    "Self-hosted path-style S3 gateway",
  ),
  S3_REGION: value(z.string().min(1), "eu-west-1", "S3 signing region"),
  S3_BUCKET: value(
    z.string().min(1),
    "shortn-v2-staging",
    "S3 bucket; use shortn-v2 in production",
  ),
  S3_ACCESS_KEY_ID: value(
    z.string().min(1),
    "replace-me",
    "S3 project access key",
  ),
  S3_SECRET_ACCESS_KEY: value(
    z.string().min(1),
    "replace-me",
    "S3 project secret key",
  ),
  NEXT_PUBLIC_APP_URL: url(
    "http://localhost:3000",
    "Legacy app origin for public asset URLs",
  ),
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
    "legacy infrastructure": legacyInfraEnv,
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
