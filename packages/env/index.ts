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
const oauth = {
  AUTH_GITHUB_ID: value(z.string().min(1), "replace-me", "GitHub OAuth app id"),
  AUTH_GITHUB_SECRET: secret("GitHub OAuth app secret"),
  AUTH_GOOGLE_ID: value(
    z.string().min(1),
    "replace-me",
    "Google OAuth client id",
  ),
  AUTH_GOOGLE_SECRET: value(
    z.string().min(16),
    "replace-me-google-client-secret",
    "Google OAuth client secret (Google's format is shorter than 32)",
  ),
};
export const polarEnvironment = value(
  z.enum(["sandbox", "production"]),
  "sandbox",
  "Polar API environment",
);
export const webEnv = z
  .object({
    ...common,
    BETTER_AUTH_SECRET: secret("Authentication secret"),
    BETTER_AUTH_URL: httpUrl(
      "http://localhost:3000",
      "Dashboard origin (app.shortn.at); auth cookies are host-only here",
    ),
    ...oauth,
    POLAR_ACCESS_TOKEN: billing.POLAR_ACCESS_TOKEN,
    POLAR_ENVIRONMENT: polarEnvironment,
    RESEND_API_KEY: mail.RESEND_API_KEY,
    MAIL_FROM: value(
      z.string().min(3).default("Shortn <no-reply@shortn.at>"),
      "Shortn <no-reply@shortn.at>",
      "Sender for account and workspace email",
    ),
    MAIL_ALLOWLIST: value(
      z.string().optional(),
      "@denizlg24.com",
      "Staging only: comma-separated recipients or @domains; others are dropped",
    ),
    PUBLIC_ORIGIN: httpUrl(
      "http://localhost:3001",
      "Root site origin (shortn.at) for marketing and legal links",
    ),
    LINK_DOMAIN: value(
      z.string().min(1).default("shortn.at"),
      "shortn.at",
      "Domain new links are created on",
    ),
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
export const billingMode = value(
  z.enum(["shadow", "live"]).default("shadow"),
  "shadow",
  "shadow: mirror + diff only, no emails or legacy hand-off; live after the billing switch (06)",
);
export const apiEnv = z
  .object({
    NODE_ENV: common.NODE_ENV,
    ...mongo,
    POLAR_ACCESS_TOKEN: billing.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: billing.POLAR_WEBHOOK_SECRET,
    POLAR_ENVIRONMENT: polarEnvironment,
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
    POLAR_ACCESS_TOKEN: billing.POLAR_ACCESS_TOKEN.optional(),
    POLAR_ENVIRONMENT: polarEnvironment,
    BILLING_MODE: billingMode,
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
