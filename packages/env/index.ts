import { z } from "zod";

const value = <S extends z.ZodType>(
  schema: S,
  example: string,
  description: string,
) => schema.meta({ example, description });
const url = (example: string, description: string) =>
  value(z.url(), example, description);
// z.httpUrl() also demands a dotted hostname, which rules out localhost.
const httpUrl = (example: string, description: string) =>
  value(z.url({ protocol: /^https?$/ }), example, description);
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
const bioRules =
  (app: "web" | "redirect" | "api" | "worker") =>
  (env: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const required: string[] = [];
    if (env.BIO_DELIVERY_ENABLED === "1") {
      if (app === "api")
        required.push(
          "REDIS_CACHE_URL",
          "REDIS_DURABLE_URL",
          "IP_HASH_SECRET",
          "PUBLIC_ORIGIN",
        );
      else required.push("BIO_INTERNAL_SECRET");
      if (app === "web") required.push("BIO_API_ORIGIN");
      if (app === "redirect" || app === "worker")
        required.push("BIO_WEB_ORIGIN");
    }
    if (env.DOMAIN_WRITES === "1" && app === "worker")
      required.push("CLOUDFLARE_ZONE_ID", "CLOUDFLARE_API_TOKEN");
    for (const key of required)
      if (!env[key])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Required for enabled P5 ${app} features`,
        });
  };
const productionRules = (
  env: Record<string, unknown>,
  ctx: z.RefinementCtx,
) => {
  if (env.NODE_ENV !== "production") return;
  if (
    env.REDIS_CACHE_URL !== undefined &&
    env.REDIS_CACHE_URL === env.REDIS_DURABLE_URL
  )
    ctx.addIssue({
      code: "custom",
      path: ["REDIS_DURABLE_URL"],
      message: "Production Redis URLs must differ",
    });
  const seen = new Set<string>();
  for (const [key, item] of Object.entries(env)) {
    if (
      !/(SECRET|TOKEN|PEPPER|API_KEY)$|^(R2_SECRET_ACCESS_KEY|WEBHOOK_SECRET_KEY)$/.test(
        key,
      ) ||
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
const bio = {
  MAIL_ALLOWLIST: value(
    z.string().optional(),
    "@denizlg24.com",
    "Staging recipient allowlist; required operationally before domain notifications are enabled",
  ),
  BIO_SUBDOMAINS: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Enable production bio wildcard hosts; staging uses internal paths",
  ),
  BIO_LEGACY_REDIRECTS: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Enable /b/ 301 redirects only after slug parity acceptance",
  ),
  BIO_DELIVERY_ENABLED: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Serve new bio renderer; /b remains legacy when disabled",
  ),
  DOMAIN_WRITES: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Enable paid hostname provisioning after operator review",
  ),
  CLOUDFLARE_ZONE_ID: value(
    z.string().min(1).optional(),
    "",
    "Cloudflare SaaS zone ID",
  ),
  CLOUDFLARE_API_TOKEN: secret(
    "Cloudflare SaaS hostname and cache purge token",
  ).optional(),
  DOMAIN_CNAME_TARGET: value(
    z.string().default("cname.shortn.at"),
    "cname.shortn.at",
    "Configured Cloudflare for SaaS CNAME target",
  ),
  POLAR_DOMAIN_PRODUCT_ID: value(
    z.uuid().optional(),
    "",
    "Domain add-on product in the configured Polar environment; metadata shortn_addon=custom_domains",
  ),
  BIO_API_ORIGIN: httpUrl(
    "http://localhost:3003",
    "Public API origin for bio view beacons",
  ).optional(),
  BIO_WEB_ORIGIN: httpUrl(
    "http://localhost:3000",
    "Web origin used by redirect and worker for bio proxy/invalidation",
  ).optional(),
  BIO_INTERNAL_SECRET: secret(
    "Authenticated bio proxy and invalidation requests",
  ).optional(),
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
const platformApi = {
  PLATFORM_API_ENABLED: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Mount public REST API routes; default disabled",
  ),
  PLATFORM_API_ROLLOUT: value(
    z.coerce.number().min(0).max(100).default(0),
    "0",
    "Percent of workspaces in the REST API cohort; explicit workspace overrides take precedence",
  ),
  API_KEY_PEPPER: secret(
    "Distinct API key hash pepper; changing it invalidates every API key",
  ).optional(),
};
const platformMcp = {
  PLATFORM_MCP_ENABLED: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Mount MCP Streamable HTTP routes; default disabled",
  ),
  PLATFORM_MCP_ROLLOUT: value(
    z.coerce.number().min(0).max(100).default(0),
    "0",
    "Percent of workspaces in the MCP cohort; explicit overrides take precedence",
  ),
  MCP_PUBLIC_ORIGIN: httpUrl(
    "https://api.shortn.at",
    "Canonical public MCP API origin for request origin validation",
  ).optional(),
};
const mcpOAuth = {
  MCP_OAUTH_ENABLED: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Enable workspace OAuth consent for MCP; default disabled",
  ),
};
const mcpOAuthRules = (env: Record<string, unknown>, ctx: z.RefinementCtx) => {
  if (env.MCP_OAUTH_ENABLED !== "1") return;
  for (const name of [
    "MCP_PUBLIC_ORIGIN",
    ...(Object.hasOwn(env, "PLATFORM_MCP_ENABLED") ? ["MCP_OAUTH_ISSUER"] : []),
  ]) {
    const value = env[name];
    if (
      typeof value !== "string" ||
      (env.NODE_ENV === "production" && !value.startsWith("https://"))
    )
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "Required for MCP OAuth; production requires HTTPS",
      });
  }
  if (
    Object.hasOwn(env, "PLATFORM_MCP_ENABLED") &&
    env.PLATFORM_MCP_ENABLED !== "1"
  )
    ctx.addIssue({
      code: "custom",
      path: ["PLATFORM_MCP_ENABLED"],
      message: "MCP must be enabled for OAuth",
    });
};
const platformWebhooks = {
  PLATFORM_WEBHOOKS_ENABLED: value(
    z.enum(["0", "1"]).default("0"),
    "0",
    "Enable outgoing webhook endpoint creation and worker delivery; default disabled",
  ),
  PLATFORM_WEBHOOKS_ROLLOUT: value(
    z.coerce.number().min(0).max(100).default(0),
    "0",
    "Percent of workspaces in the outgoing webhook cohort; workspace overrides take precedence",
  ),
  WEBHOOK_SECRET_KEY: secret(
    "Distinct encryption key for recoverable outgoing webhook signing secrets",
  ).optional(),
};
const webhookRules = (env: Record<string, unknown>, ctx: z.RefinementCtx) => {
  if (env.PLATFORM_WEBHOOKS_ENABLED !== "1") return;
  for (const key of [
    "WEBHOOK_SECRET_KEY",
    "REDIS_CACHE_URL",
    "REDIS_DURABLE_URL",
  ])
    if (!env[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required when PLATFORM_WEBHOOKS_ENABLED=1",
      });
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
const objectStorage = {
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
};

function privateExportRules(
  config: Record<string, unknown>,
  ctx: z.RefinementCtx,
) {
  if (config.EXPORTS_ENABLED !== "1") return;
  for (const field of [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    if (!config[field])
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Required for private exports",
      });
  if (
    config.NODE_ENV === "production" &&
    typeof config.S3_ENDPOINT === "string" &&
    !config.S3_ENDPOINT.startsWith("https://")
  )
    ctx.addIssue({
      code: "custom",
      path: ["S3_ENDPOINT"],
      message: "Production export storage requires HTTPS",
    });
}

export const webEnv = z
  .object({
    EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private data exports; requires object storage and export worker",
    ),
    IMPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private CSV import dashboard flows; requires object storage and worker",
    ),
    QR_EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private QR export dashboard flows; requires object storage and worker",
    ),
    ...common,
    ...platformApi,
    ...mcpOAuth,
    MCP_PUBLIC_ORIGIN: platformMcp.MCP_PUBLIC_ORIGIN,
    PLATFORM_MCP_ROLLOUT: platformMcp.PLATFORM_MCP_ROLLOUT,
    ...platformWebhooks,
    ...bio,
    S3_ENDPOINT: objectStorage.S3_ENDPOINT.optional().meta(
      objectStorage.S3_ENDPOINT.meta() ?? {},
    ),
    S3_REGION: objectStorage.S3_REGION.optional().meta(
      objectStorage.S3_REGION.meta() ?? {},
    ),
    S3_BUCKET: objectStorage.S3_BUCKET.optional().meta(
      objectStorage.S3_BUCKET.meta() ?? {},
    ),
    S3_ACCESS_KEY_ID: objectStorage.S3_ACCESS_KEY_ID.optional().meta(
      objectStorage.S3_ACCESS_KEY_ID.meta() ?? {},
    ),
    S3_SECRET_ACCESS_KEY: objectStorage.S3_SECRET_ACCESS_KEY.optional().meta(
      objectStorage.S3_SECRET_ACCESS_KEY.meta() ?? {},
    ),
    BETTER_AUTH_SECRET: secret("Authentication secret"),
    BETTER_AUTH_URL: httpUrl(
      "http://localhost:3000",
      "Dashboard origin (app.shortn.at); auth cookies are host-only here",
    ),
    SSO_TRUSTED_ORIGINS: value(
      z.string().default(""),
      "https://login.microsoftonline.com,https://your-company.okta.com",
      "Comma-separated operator-approved identity provider origins; no wildcards",
    ),
    AUTH_GITHUB_ID: oauth.AUTH_GITHUB_ID.optional(),
    AUTH_GITHUB_SECRET: oauth.AUTH_GITHUB_SECRET.optional(),
    AUTH_GOOGLE_ID: oauth.AUTH_GOOGLE_ID.optional(),
    AUTH_GOOGLE_SECRET: oauth.AUTH_GOOGLE_SECRET.optional(),
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
    WEB_RISK_API_KEY: value(
      z.string().min(1).optional(),
      "",
      "Google Web Risk key for link scans; without it scans are structural only",
    ),
    LINK_ACCESS_SECRET: security.LINK_ACCESS_SECRET,
    CONFIRMATION_TOKEN_SECRET: mail.CONFIRMATION_TOKEN_SECRET,
    IP_HASH_SECRET: secret(
      "HMAC secret for visitor IPs (reports, rate limits)",
    ),
    LEGACY_ORIGIN: httpUrl(
      "http://localhost:3001",
      "Legacy app origin, for the /b/ revalidation hook during coexistence",
    ).optional(),
    LEGACY_INTERNAL_SECRET: value(
      z.string().min(32).optional(),
      "",
      "Legacy INTERNAL_API_SECRET, sent to its revalidation hook",
    ),
    BILLING_WRITES: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "1 after the billing switch: plan changes and cancellation from this app (16 D8)",
    ),
    PORT: value(
      z.coerce.number().int().min(1).max(65535).default(3000),
      "3000",
      "Web port",
    ),
  })
  .superRefine(webhookRules)
  .superRefine(privateExportRules)
  .superRefine(productionRules)
  .superRefine(bioRules("web"))
  .superRefine(mcpOAuthRules)
  .superRefine((config, ctx) => {
    if (config.IMPORTS_ENABLED !== "1") return;
    for (const field of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const)
      if (!config[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for imports",
        });
    if (
      config.NODE_ENV === "production" &&
      config.S3_ENDPOINT &&
      !config.S3_ENDPOINT.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "Production import storage requires HTTPS",
      });
  })
  .superRefine((config, ctx) => {
    if (config.QR_EXPORTS_ENABLED !== "1") return;
    for (const field of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const)
      if (!config[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for QR exports",
        });
    if (
      config.NODE_ENV === "production" &&
      config.S3_ENDPOINT &&
      !config.S3_ENDPOINT.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "Production storage requires HTTPS",
      });
  });
export const redirectEnv = z
  .object({
    ...common,
    ...bio,
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
  .superRefine(productionRules)
  .superRefine(bioRules("redirect"));
export const billingMode = value(
  z.enum(["shadow", "live"]).default("shadow"),
  "shadow",
  "shadow: mirror + diff only, no emails or legacy hand-off; live after the billing switch (06)",
);
export const apiEnv = z
  .object({
    EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private data exports; requires object storage and export worker",
    ),
    QR_EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private QR exports in API and MCP; requires object storage",
    ),
    S3_ENDPOINT: objectStorage.S3_ENDPOINT.optional(),
    S3_REGION: objectStorage.S3_REGION.optional(),
    S3_BUCKET: objectStorage.S3_BUCKET.optional(),
    S3_ACCESS_KEY_ID: objectStorage.S3_ACCESS_KEY_ID.optional(),
    S3_SECRET_ACCESS_KEY: objectStorage.S3_SECRET_ACCESS_KEY.optional(),
    NODE_ENV: common.NODE_ENV,
    ...mongo,
    REDIS_CACHE_URL: redis.REDIS_CACHE_URL.optional(),
    REDIS_DURABLE_URL: redis.REDIS_DURABLE_URL.optional(),
    ...platformApi,
    ...platformMcp,
    ...mcpOAuth,
    MCP_OAUTH_ISSUER: httpUrl(
      "https://app.shortn.at/api/auth",
      "Canonical OAuth issuer for MCP JWT verification",
    ).optional(),
    ...platformWebhooks,
    LINK_DOMAIN: value(
      z.string().min(1).default("shortn.at"),
      "shortn.at",
      "Default short-link domain for public API services",
    ),
    ...bio,
    IP_HASH_SECRET: secret("Bio view rate-limit IP HMAC secret").optional(),
    PUBLIC_ORIGIN: httpUrl(
      "http://localhost:3001",
      "Public root origin for bio view CORS",
    ).optional(),
    POLAR_ACCESS_TOKEN: billing.POLAR_ACCESS_TOKEN,
    POLAR_WEBHOOK_SECRET: billing.POLAR_WEBHOOK_SECRET,
    POLAR_ENVIRONMENT: polarEnvironment,
    PORT: value(
      z.coerce.number().int().min(1).max(65535).default(3003),
      "3003",
      "API port",
    ),
  })
  .superRefine((env, ctx) => {
    if (env.PLATFORM_API_ENABLED !== "1" && env.PLATFORM_MCP_ENABLED !== "1")
      return;
    for (const key of [
      "API_KEY_PEPPER",
      "REDIS_CACHE_URL",
      "REDIS_DURABLE_URL",
    ] as const)
      if (!env[key])
        ctx.addIssue({
          code: "custom",
          path: [key],
          message:
            "Required when PLATFORM_API_ENABLED=1 or PLATFORM_MCP_ENABLED=1",
        });
    if (
      env.PLATFORM_MCP_ENABLED === "1" &&
      (!env.MCP_PUBLIC_ORIGIN ||
        (env.NODE_ENV === "production" &&
          !env.MCP_PUBLIC_ORIGIN.startsWith("https://")))
    )
      ctx.addIssue({
        code: "custom",
        path: ["MCP_PUBLIC_ORIGIN"],
        message: "Required when MCP is enabled; production requires HTTPS",
      });
  })
  .superRefine(webhookRules)
  .superRefine(privateExportRules)
  .superRefine(productionRules)
  .superRefine(bioRules("api"))
  .superRefine(mcpOAuthRules)
  .superRefine((config, ctx) => {
    if (config.QR_EXPORTS_ENABLED !== "1") return;
    for (const field of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const) {
      if (!config[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for QR exports",
        });
    }
    if (
      config.NODE_ENV === "production" &&
      config.S3_ENDPOINT &&
      !config.S3_ENDPOINT.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "Production storage requires HTTPS",
      });
  });
const liveBillingNeedsMail = (
  env: Record<string, unknown>,
  ctx: z.RefinementCtx,
) => {
  if (env.BILLING_MODE !== "live") return;
  for (const key of ["POLAR_ACCESS_TOKEN", "RESEND_API_KEY", "APP_URL"])
    if (!env[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required when BILLING_MODE=live",
      });
};
export const workerEnv = z
  .object({
    EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private data exports; requires object storage and export worker",
    ),
    ...common,
    IMPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable durable CSV import worker; requires private object storage",
    ),
    QR_EXPORTS_ENABLED: value(
      z.enum(["0", "1"]).default("0"),
      "0",
      "Enable private QR export worker; requires object storage and APP_URL",
    ),
    S3_ENDPOINT: objectStorage.S3_ENDPOINT.optional(),
    S3_REGION: objectStorage.S3_REGION.optional(),
    S3_BUCKET: objectStorage.S3_BUCKET.optional(),
    S3_ACCESS_KEY_ID: objectStorage.S3_ACCESS_KEY_ID.optional(),
    S3_SECRET_ACCESS_KEY: objectStorage.S3_SECRET_ACCESS_KEY.optional(),
    ...platformWebhooks,
    ...bio,
    PUBLIC_ORIGIN: httpUrl(
      "http://localhost:3001",
      "Public root origin for bio cache purge",
    ).optional(),
    IP_HASH_SECRET: secret("Click IP HMAC secret"),
    LINK_DOMAIN: redirectEnv.shape.LINK_DOMAIN,
    WEB_RISK_API_KEY: webEnv.shape.WEB_RISK_API_KEY,
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
    RESEND_API_KEY: mail.RESEND_API_KEY.optional(),
    MAIL_FROM: value(
      z.string().min(3).default("Shortn <no-reply@shortn.at>"),
      "Shortn <no-reply@shortn.at>",
      "Sender for billing email",
    ),
    APP_URL: httpUrl(
      "http://localhost:3000",
      "Dashboard origin for links in billing email",
    ).optional(),
    RUN_CONTINUOUS_MIGRATIONS: value(
      z.enum(["0", "1"]).default("1"),
      "1",
      "Run continuous expand migrations every minute",
    ),
  })
  .superRefine(webhookRules)
  .superRefine(privateExportRules)
  .superRefine(productionRules)
  .superRefine(liveBillingNeedsMail)
  .superRefine((config, ctx) => {
    if (config.IMPORTS_ENABLED !== "1") return;
    for (const field of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const)
      if (!config[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for imports",
        });
    if (
      config.NODE_ENV === "production" &&
      config.S3_ENDPOINT &&
      !config.S3_ENDPOINT.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "Production import storage requires HTTPS",
      });
  })
  .superRefine((config, ctx) => {
    if (config.QR_EXPORTS_ENABLED !== "1") return;
    for (const field of [
      "S3_ENDPOINT",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "APP_URL",
    ] as const) {
      if (!config[field])
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Required for QR exports",
        });
    }
    if (
      config.NODE_ENV === "production" &&
      config.S3_ENDPOINT &&
      !config.S3_ENDPOINT.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["S3_ENDPOINT"],
        message: "Production storage requires HTTPS",
      });
    if (
      config.NODE_ENV === "production" &&
      config.APP_URL &&
      !config.APP_URL.startsWith("https://")
    )
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Production QR logo origin requires HTTPS",
      });
  })
  .superRefine(bioRules("worker"));

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
  ...objectStorage,
  NEXT_PUBLIC_APP_URL: url(
    "http://localhost:3000",
    "Legacy app origin for public asset URLs",
  ),
});

export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
): z.output<S> {
  // Empty entries in dotenv files mean "not configured". This also lets a
  // dev launcher mask local files without enabling optional integrations.
  const configured = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const result = schema.safeParse(configured);
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
