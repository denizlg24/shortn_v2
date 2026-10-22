import { apiRateLimit, rateScript } from "./rate-limit";
import { workspaceBlock } from "./workspace-access";
import { bioContentSchema } from "@shortn/core/bio-content";
import { createHash } from "node:crypto";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDocumentationApp } from "@shortn/docs";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { Redis } from "ioredis";
import type { Db } from "mongodb";
import { loadEntitlements, type Entitlements } from "@shortn/billing";
import {
  expandLinks,
  type LinkExpansion,
  createWebhook,
  getWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
  redeliverWebhook,
  webhookWritable,
  webhookView,
  webhookInput,
  webhookPatchInput,
  webhookEvents,
  sealWebhookSecret,
  openWebhookSecret,
  createBioPage,
  createBioPageInput,
  cursorBioPages,
  readBioDraft,
  bioDraftPatchInput,
  patchBioDraft,
  publishBioDraft,
  addDomain,
  addDomainSchema,
  cursorDomains,
  getDomain,
  removeDomain,
  queryAnalytics,
  dimensions,
  authenticateApiKey,
  hasApiScope,
  platformFeatureEnabled,
  countUsage,
  pageCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  listLinks,
  getLink,
  getLinkByKey,
  createLink,
  createMany,
  linkRulesInputSchema,
  socialPreviewSchema,
  linkHealthViewSchema,
  updateLink,
  deleteLinks,
  restoreLinks,
  cursorQrs,
  createQr,
  getQr,
  updateQr,
  deleteQrs,
  qrDesignSchema,
  requestQrExport,
  qrExportDelivery,
  requestQrZip,
  qrZipDelivery,
  QR_ZIP_LIMIT,
  QR_ZIP_MAX_BYTES,
  cursorTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  can,
  type ApiPrincipal,
  type ServiceContext,
} from "@shortn/core";

export interface RestDeps {
  qrExports?: {
    sign: (key: string, seconds: number, filename: string) => Promise<string>;
  };
  db: Db;
  cache: Redis;
  durable: Redis;
  pepper: string;
  linkDomain: string;
  rolloutPercent: number;
  domainWrites?: boolean;
  webhooksEnabled?: boolean;
  webhookSecretKey?: string;
  webhooksRolloutPercent?: number;
  clientIp: (request: Request) => string | undefined;
  log: (message: string, error?: unknown) => void;
}
type RestEnv = {
  Variables: {
    principal: ApiPrincipal;
    service: ServiceContext;
    entitlements: Entitlements;
  };
};

const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    code: z.string(),
    instance: z.string(),
    context: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional(),
  })
  .openapi("Problem");
const failure = {
  description: "Request failed; code is stable across API versions",
  content: { "application/problem+json": { schema: problemSchema } },
};
type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503;
function problem<S extends ProblemStatus>(
  c: Context,
  status: S,
  code: string,
  context?: Record<string, string | number | null>,
) {
  c.header("Content-Type", "application/problem+json");
  if (status === 401) c.header("WWW-Authenticate", 'Bearer realm="shortn"');
  return c.json(
    {
      type: `https://shortn.at/docs/api/errors#${code}`,
      title: code.replaceAll("_", " "),
      status,
      code,
      instance: c.req.path,
      ...(context ? { context } : {}),
    },
    status,
    { "Content-Type": "application/problem+json" },
  );
}

const qrExportSchema = z
  .object({
    id: z.string(),
    state: z.enum(["pending", "running", "completed", "failed"]),
    format: z.enum(["svg", "png", "pdf"]),
    size: z.number(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    error: z.string().optional(),
    print: z
      .object({
        minimumMm: z.number(),
        quietModules: z.number(),
        correction: z.string(),
      })
      .optional(),
    downloadUrl: z.string().url().optional(),
    downloadExpiresAt: z.string().datetime().optional(),
  })
  .openapi("QrExportJob");
const qrZipSchema = z
  .object({
    id: z.string(),
    state: z.enum(["pending", "running", "completed", "failed"]),
    phase: z.enum(["rendering", "assembling"]),
    itemFormat: z.enum(["svg", "png", "pdf"]),
    size: z.number(),
    total: z.number(),
    done: z.number(),
    limit: z.number(),
    maximumBytes: z.number(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    error: z.string().optional(),
    failedQrId: z.string().optional(),
    downloadUrl: z.string().url().optional(),
    downloadExpiresAt: z.string().datetime().optional(),
  })
  .openapi("QrZipExportJob");

const campaignSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    linkCount: z.number(),
    utmDefaults: z.object({
      sources: z.array(z.string()),
      mediums: z.array(z.string()),
      terms: z.array(z.string()),
      contents: z.array(z.string()),
    }),
    createdAt: z.string(),
    createdBy: z.string().nullable(),
  })
  .openapi("Campaign");

const tagSchema = z
  .object({
    id: z.string(),
    legacyId: z.string().nullable(),
    name: z.string(),
    createdAt: z.string(),
    createdBy: z.string().nullable(),
  })
  .openapi("Tag");

const expansionQuery = z.object({
  expand: z
    .string()
    .max(100)
    .regex(/^(?:tags|campaign)(?:,(?:tags|campaign))*$/)
    .optional()
    .openapi({
      description:
        "Comma-separated full metadata expansions: tags,campaign. Each requires its resource read scope. Results are in expanded.tags / expanded.campaign arrays; unavailable references are omitted.",
    }),
});
const linkSchema = z
  .object({
    id: z.string(),
    domain: z.string(),
    key: z.string(),
    url: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
    clicks: z.number(),
    lastClickAt: z.string().nullable(),
    createdAt: z.string(),
    createdBy: z.string().nullable(),
    password: z.object({ hint: z.string().nullable() }).nullable(),
    safety: z.object({
      status: z.string(),
      disabled: z.boolean(),
      interstitial: z.boolean(),
    }),
    health: linkHealthViewSchema.optional(),
    rules: linkRulesInputSchema.optional(),
    og: socialPreviewSchema.optional(),
    expanded: z
      .object({
        tags: z.array(tagSchema).optional(),
        campaign: z.array(campaignSchema).optional(),
      })
      .optional(),
    qrCodeId: z.string().nullable(),
    moderation: z
      .object({ state: z.literal("taken_down"), category: z.string() })
      .nullable()
      .optional()
      .openapi({
        description:
          "Set when Shortn removed the link for a policy violation. It no longer redirects and can't be edited; it can still be deleted.",
      }),
    deletedAt: z.string().nullable().optional(),
    restoreUntil: z.string().nullable().optional(),
    utm: z.array(
      z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        campaign: z.string().nullable(),
        term: z.string().nullable(),
        content: z.string().nullable(),
      }),
    ),
  })
  .openapi("Link");
const createInput = z
  .object({
    url: z.string().max(8192),
    rules: linkRulesInputSchema.optional(),
    og: socialPreviewSchema.optional(),
    domain: z.string().max(253).optional(),
    key: z.string().max(100).optional(),
    title: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    tags: z.array(z.string().max(100)).max(100).optional(),
    password: z.string().max(200).optional(),
    passwordHint: z.string().max(100).optional(),
  })
  .strict()
  .openapi("CreateLink");
const updateInput = createInput
  .omit({ domain: true })
  .partial()
  .extend({
    description: z.string().max(5000).nullable().optional(),
    passwordHint: z.string().max(100).nullable().optional(),
    removePassword: z.boolean().optional(),
    rules: linkRulesInputSchema.nullable().optional(),
    og: socialPreviewSchema.nullable().optional(),
  })
  .strict()
  .openapi("UpdateLink");
const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
const security = [{ ApiKey: [] }];
const errors = {
  400: failure,
  401: failure,
  403: failure,
  404: failure,
  409: failure,
  413: failure,
  429: failure,
  500: failure,
};
const dimension = z.enum(
  Object.keys(dimensions) as [
    keyof typeof dimensions,
    ...(keyof typeof dimensions)[],
  ],
);
const analyticsQuery = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  timezone: z.string().max(64).default("UTC"),
  interval: z.enum(["hour", "day", "week", "month"]).default("day"),
  groupBy: dimension.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  link: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  kind: z.enum(["click", "scan"]).optional(),
  country: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(200).optional(),
  continent: z.string().min(1).max(200).optional(),
  device: z.string().min(1).max(200).optional(),
  browser: z.string().min(1).max(200).optional(),
  os: z.string().min(1).max(200).optional(),
  referrer: z.string().min(1).max(200).optional(),
  utmSource: z.string().min(1).max(200).optional(),
  utmMedium: z.string().min(1).max(200).optional(),
  utmCampaign: z.string().min(1).max(200).optional(),
  utmTerm: z.string().min(1).max(200).optional(),
  utmContent: z.string().min(1).max(200).optional(),
  language: z.string().min(1).max(200).optional(),
  branch: z.string().min(1).max(64).optional(),
});
const analyticsTotals = z.object({
  clicks: z.number(),
  scans: z.number(),
  uniques: z.number(),
});
const analyticsSchema = z
  .object({
    range: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      clampedFrom: z.iso.datetime().nullable(),
    }),
    totals: analyticsTotals,
    previous: analyticsTotals,
    series: z.array(
      z.object({ t: z.iso.datetime(), clicks: z.number(), scans: z.number() }),
    ),
    breakdowns: z.partialRecord(
      dimension,
      z.array(
        z.object({ value: z.string(), clicks: z.number(), scans: z.number() }),
      ),
    ),
    gated: z.array(dimension),
    options: z.partialRecord(dimension, z.array(z.string())),
    linkLabels: z.record(z.string(), z.string()),
    scopeFilters: z.record(z.string(), z.string()),
  })
  .openapi("Analytics");
const analyticsResponses = {
  200: {
    description:
      "Analytics within the plan query window; gated lists unavailable breakdowns",
    content: { "application/json": { schema: analyticsSchema } },
  },
  ...errors,
};

const domainSchema = z
  .object({
    id: z.string(),
    hostname: z.string(),
    kind: z.string(),
    status: z.string(),
    error: z.string(),
    verification: z
      .object({
        type: z.string(),
        name: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),
    validationRecords: z.array(
      z.object({
        txt_name: z.string().optional(),
        txt_value: z.string().optional(),
      }),
    ),
    removing: z.boolean(),
    bioPageId: z.string().optional(),
    createdAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .openapi("Domain");

const bioSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    linkCount: z.number(),
    avatarUrl: z.string().nullable(),
    updatedAt: z.iso.datetime(),
    createdBy: z.string().nullable(),
  })
  .openapi("BioSummary");
const bioDraftSchema = z
  .object({
    id: z.string(),
    handle: z.string(),
    revision: z.number(),
    publishedRevision: z.number(),
    published: z.boolean(),
    content: bioContentSchema,
  })
  .openapi("BioDraft");
const bioRevisionSchema = z.object({ revision: z.number().int().min(0) });

const webhookSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
    events: z.array(z.enum(webhookEvents)),
    enabled: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    failureSince: z.iso.datetime().nullable(),
    disabledAt: z.iso.datetime().nullable(),
    adminDisabled: z
      .object({ at: z.iso.datetime(), reason: z.string() })
      .nullable()
      .openapi({
        description:
          "Set when Shortn disabled the endpoint. It can't be re-enabled until Shortn lifts this.",
      }),
  })
  .openapi("Webhook");
const queuedWebhookSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  status: z.string(),
});
const webhookPageQuery = z.object({
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(200).optional(),
});
const webhookDeliverySchema = z.object({
  id: z.string(),
  eventId: z.string(),
  type: z.enum([...webhookEvents, "webhook.test"]),
  status: z.enum(["pending", "sending", "delivered", "failed", "cancelled"]),
  attempts: z.number(),
  createdAt: z.iso.datetime(),
  deliveredAt: z.iso.datetime().nullable(),
  lastStatus: z.number().nullable(),
  lastError: z.string().nullable(),
});

const storedResponse = z.object({
  fingerprint: z.string(),
  status: z
    .union([
      z.literal(200),
      z.literal(201),
      z.literal(202),
      z.literal(400),
      z.literal(401),
      z.literal(403),
      z.literal(404),
      z.literal(409),
      z.literal(413),
      z.literal(429),
      z.literal(500),
    ])
    .optional(),
  body: z.string().optional(),
  bodyEncoding: z.literal("sealed").optional(),
  contentType: z.string().optional(),
  location: z.string().optional(),
});

export function createRestApi(deps: RestDeps) {
  const webhookConfig = {
    enabled: deps.webhooksEnabled ?? false,
    secretKey: deps.webhookSecretKey ?? "",
    rolloutPercent: deps.webhooksRolloutPercent ?? 0,
  };
  const app = new OpenAPIHono<RestEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return problem(c, 400, "invalid_input");
    },
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "ApiKey", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "sk_live_…",
  });
  // REST uses explicit bearer keys; cookies are never accepted. This also
  // enables direct requests from the public Scalar mirror without a proxy.
  app.use(
    "/v1/*",
    cors({
      origin: "*",
      allowMethods: [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      exposeHeaders: [
        "Location",
        "Retry-After",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
      ],
      maxAge: 600,
      credentials: false,
    }),
  );
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: 1_048_576,
      onError: (c) => problem(c, 413, "body_too_large"),
    }),
  );
  app.use("/v1/*", async (c, next) => {
    const authorization = c.req.header("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return problem(c, 401, "unauthorized");
    const auth = await authenticateApiKey(
      deps.db,
      authorization.slice(7),
      deps.pepper,
      deps.clientIp(c.req.raw),
      undefined,
      deps.cache,
    );
    if (!auth.ok) return problem(c, 401, auth.error);
    const principal = auth.value;
    if (
      !platformFeatureEnabled(principal.workspace, "api", deps.rolloutPercent)
    )
      return problem(c, 404, "feature_disabled");
    const blocked = workspaceBlock(
      principal.workspace,
      c.req.method,
      c.req.path,
    );
    if (blocked) return problem(c, 403, blocked);
    c.set("principal", principal);
    c.set("service", {
      db: deps.db,
      cache: deps.cache,
      workspace: principal.workspace,
      actor: principal.actor,
      linkDomain: deps.linkDomain,
    });
    const entitlements = await loadEntitlements(deps.db, principal.workspace);
    c.set("entitlements", entitlements);
    const limit = apiRateLimit(entitlements);
    if (limit === null) return next();
    const result = z
      .tuple([z.number(), z.number(), z.number()])
      .parse(
        await deps.cache.eval(
          rateScript,
          1,
          `api:rate:${principal.keyId}`,
          Date.now(),
          limit,
          crypto.randomUUID(),
        ),
      );
    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(result[1]));
    c.header("RateLimit-Reset", String(result[2]));
    if (!result[0]) {
      c.header("Retry-After", String(result[2]));
      return problem(c, 429, "rate_limited");
    }
    await next();
  });
  app.use("/v1/*", async (c, next) => {
    const resource =
      c.req.path === "/v1/links" ||
      (c.req.path.startsWith("/v1/links/") &&
        !/^\/v1\/links\/[a-f\d]{24}\/analytics$/i.test(c.req.path))
        ? "links"
        : c.req.path === "/v1/campaigns" ||
            c.req.path.startsWith("/v1/campaigns/")
          ? "campaigns"
          : c.req.path.startsWith("/v1/qr-exports/") ||
              c.req.path === "/v1/qr-codes" ||
              c.req.path.startsWith("/v1/qr-codes/")
            ? "qr"
            : c.req.path === "/v1/tags" || c.req.path.startsWith("/v1/tags/")
              ? "tags"
              : c.req.path === "/v1/domains" ||
                  c.req.path.startsWith("/v1/domains/")
                ? "domains"
                : c.req.path === "/v1/bio-pages" ||
                    c.req.path.startsWith("/v1/bio-pages/")
                  ? "bio"
                  : c.req.path === "/v1/webhooks" ||
                      c.req.path.startsWith("/v1/webhooks/")
                    ? "webhooks"
                    : null;
    if (resource) {
      const read =
        c.req.method === "GET" ||
        c.req.method === "HEAD" ||
        (c.req.method === "POST" && c.req.path === "/v1/qr-codes/export");
      if (
        !hasApiScope(
          c.get("principal"),
          read ? `${resource}:read` : `${resource}:write`,
        )
      )
        return problem(c, 403, "insufficient_scope");
      if (
        !read &&
        !can(
          c.get("principal").actor,
          c.req.method === "POST" ? "resource.create" : "resource.update",
        )
      )
        return problem(c, 403, "forbidden");
    }
    if (
      resource === "links" &&
      /^\/v1\/links(?:\/by-key(?:\/[^/]+\/[^/]+)?|\/[a-f\d]{24})?$/i.test(
        c.req.path,
      ) &&
      (c.req.method === "GET" || c.req.method === "HEAD")
    ) {
      const parsed = expansionQuery.safeParse({
        expand: c.req.query("expand"),
      });
      if (!parsed.success) return problem(c, 400, "invalid_input");
      for (const field of parsed.data.expand?.split(",") ?? []) {
        if (
          !hasApiScope(
            c.get("principal"),
            field === "tags" ? "tags:read" : "campaigns:read",
          )
        )
          return problem(c, 403, "insufficient_scope");
      }
    }
    if (resource === "webhooks") {
      if (!can(c.get("principal").actor, "webhooks.manage"))
        return problem(c, 403, "forbidden");
      if (c.req.method === "POST" || c.req.method === "PATCH") {
        const blocked = webhookWritable(c.get("service"), webhookConfig);
        if (blocked)
          return problem(c, serviceErrorStatus(blocked.error), blocked.error);
      }
    }
    if (
      resource === "domains" &&
      c.req.method !== "GET" &&
      c.req.method !== "HEAD"
    ) {
      if (!can(c.get("principal").actor, "billing.manage"))
        return problem(c, 403, "forbidden");
      if (c.req.method === "POST" && !deps.domainWrites)
        return problem(c, 403, "feature_disabled");
    }
    if (
      c.req.method === "POST" &&
      /^\/v1\/links\/[a-f\d]{24}\/restore$/i.test(c.req.path)
    ) {
      const link = await getLink(c.get("service"), c.req.path.split("/")[3]!, {
        includeDeleted: true,
      });
      if (
        link &&
        !can(c.get("principal").actor, "resource.delete", {
          createdBy: link.createdBy ?? undefined,
        })
      )
        return problem(c, 403, "forbidden");
    }
    if (c.req.method === "POST" && c.req.path === "/v1/qr-codes") {
      try {
        const attachment = z
          .object({ attachToLinkId: z.string().optional() })
          .safeParse(await c.req.raw.clone().json());
        if (
          attachment.success &&
          attachment.data.attachToLinkId &&
          !hasApiScope(c.get("principal"), "links:write")
        )
          return problem(c, 403, "insufficient_scope");
      } catch {
        return problem(c, 400, "invalid_input");
      }
    }
    if (c.req.method !== "POST" || !c.req.header("Idempotency-Key"))
      return next();
    const supplied = c.req.header("Idempotency-Key")!;
    if (supplied.length > 200 || !/^[\x21-\x7e]+$/.test(supplied))
      return problem(c, 400, "invalid_idempotency_key");
    const fingerprint = createHash("sha256")
      .update(c.req.url + "\n" + (await c.req.raw.clone().text()))
      .digest("hex");
    const key = `api:idempotency:${c.get("principal").keyId}:${createHash("sha256").update(supplied).digest("hex")}`;
    const reserved = await deps.durable.set(
      key,
      JSON.stringify({ fingerprint }),
      "EX",
      86_400,
      "NX",
    );
    if (!reserved) {
      const previous = storedResponse.parse(
        JSON.parse((await deps.durable.get(key)) ?? "{}"),
      );
      if (previous.fingerprint !== fingerprint)
        return problem(c, 409, "idempotency_conflict");
      if (previous.status === undefined || previous.body === undefined)
        return problem(c, 409, "idempotency_pending");
      c.header("Idempotency-Replayed", "true");
      if (previous.location) c.header("Location", previous.location);
      return c.newResponse(
        previous.bodyEncoding === "sealed"
          ? openWebhookSecret(previous.body, webhookConfig.secretKey)
          : previous.body,
        previous.status,
        {
          "Content-Type": previous.contentType ?? "application/json",
        },
      );
    }
    // A pending record survives a crash/uncertain write, preventing a retry
    // from issuing the mutation again during the 24-hour retention window.
    await next();
    await deps.durable.set(
      key,
      JSON.stringify({
        fingerprint,
        status: c.res.status,
        body:
          resource === "webhooks" && c.req.path === "/v1/webhooks"
            ? sealWebhookSecret(
                await c.res.clone().text(),
                webhookConfig.secretKey,
              )
            : await c.res.clone().text(),
        ...(resource === "webhooks" && c.req.path === "/v1/webhooks"
          ? { bodyEncoding: "sealed" }
          : {}),
        contentType: c.res.headers.get("Content-Type") ?? "application/json",
        location: c.res.headers.get("Location") ?? undefined,
      }),
      "EX",
      86_400,
    );
  });

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/links",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^\d+_[a-f\d]{24}$/i)
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          search: z.string().max(200).optional(),
          tags: z.string().max(2000).optional(),
          trash: z.enum(["true", "false"]).default("false"),
          ...expansionQuery.shape,
        }),
      },
      responses: {
        200: {
          description: "Paginated links",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(linkSchema),
                nextCursor: z.string().nullable(),
                total: z.number().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "links:read"))
        return problem(c, 403, "insufficient_scope");
      const query = c.req.valid("query");
      const result = await listLinks(c.get("service"), {
        ...query,
        tags: query.tags?.split(",").filter(Boolean),
        trash: query.trash === "true",
      });
      return c.json(
        {
          items: await expandLinks(
            c.get("service"),
            result.links,
            (query.expand?.split(",") ?? []) as LinkExpansion[],
          ),
          nextCursor: result.nextCursor,
          total: result.total,
        },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/links/by-key",
      security,
      request: {
        query: z.object({
          key: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
          domain: z.string().trim().min(1).max(253).optional(),
          ...expansionQuery.shape,
        }),
      },
      responses: {
        200: {
          description: "A workspace link identified by domain and short key",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "links:read"))
        return problem(c, 403, "insufficient_scope");
      const { key, domain } = c.req.valid("query");
      const link = await getLinkByKey(c.get("service"), key, domain);
      return link
        ? c.json(
            (
              await expandLinks(
                c.get("service"),
                [link],
                (c.req.valid("query").expand?.split(",") ??
                  []) as LinkExpansion[],
              )
            )[0]!,
            200,
          )
        : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/links/by-key/{domain}/{key}",
      security,
      request: {
        query: expansionQuery,
        params: z.object({
          domain: z.string().min(1).max(253),
          key: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
        }),
      },
      responses: {
        200: {
          description: "Link by domain and short key",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { domain, key } = c.req.valid("param");
      const link = await getLinkByKey(c.get("service"), key, domain);
      return link
        ? c.json(
            (
              await expandLinks(
                c.get("service"),
                [link],
                (c.req.valid("query").expand?.split(",") ??
                  []) as LinkExpansion[],
              )
            )[0]!,
            200,
          )
        : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/links/{id}",
      security,
      request: { params: idParam },
      responses: {
        204: {
          description: "Link moved to trash for 30 days; keys remain reserved",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await deleteLinks(c.get("service"), [
        c.req.valid("param").id,
      ]);
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/links/{id}/restore",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description: "Restored link",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").id;
      const result = await restoreLinks(c.get("service"), [id]);
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      if (!result.value.restored.includes(id))
        return problem(c, 404, "not_found");
      const link = await getLink(c.get("service"), id);
      return link ? c.json(link, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/links/{id}",
      security,
      request: { params: idParam, query: expansionQuery },
      responses: {
        200: {
          description: "Link",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "links:read"))
        return problem(c, 403, "insufficient_scope");
      const link = await getLink(c.get("service"), c.req.valid("param").id);
      return link
        ? c.json(
            (
              await expandLinks(
                c.get("service"),
                [link],
                (c.req.valid("query").expand?.split(",") ??
                  []) as LinkExpansion[],
              )
            )[0]!,
            200,
          )
        : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/links/bulk",
      security,
      description:
        "Atomically create 1–1000 links, within the 1 MiB request body limit. Validation or quota failure creates no links or tags. Use Idempotency-Key for safe retries. The response preserves input order. Error context.index is zero-based; quota errors include limit, used and requested.",
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z
                .object({ links: z.array(createInput).min(1).max(1000) })
                .strict()
                .openapi("CreateLinksBulk"),
            },
          },
        },
      },
      responses: {
        201: {
          description: "All requested links created",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(linkSchema),
                count: z.number().int(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createMany(
        c.get("service"),
        c.req.valid("json").links,
      );
      if (!result.ok)
        return problem(
          c,
          serviceErrorStatus(result.error),
          result.error,
          result.detail,
        );
      return c.json({ items: result.value, count: result.value.length }, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/links",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: createInput } },
        },
      },
      responses: {
        201: {
          description: "Created link",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "links:write"))
        return problem(c, 403, "insufficient_scope");
      const result = await createLink(c.get("service"), c.req.valid("json"));
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/links/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/links/{id}",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: { "application/json": { schema: updateInput } },
        },
      },
      responses: {
        200: {
          description: "Updated link",
          content: { "application/json": { schema: linkSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "links:write"))
        return problem(c, 403, "insufficient_scope");
      const result = await updateLink(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/workspace",
      security,
      responses: {
        200: {
          description: "The workspace associated with the bearer key",
          content: {
            "application/json": {
              schema: z
                .object({
                  id: z.string(),
                  name: z.string(),
                  slug: z.string(),
                  personal: z.boolean(),
                  defaultDomain: z.string(),
                  plan: z.enum(["free", "basic", "plus", "pro", "enterprise"]),
                  role: z.enum(["owner", "admin", "member", "viewer"]),
                  createdAt: z.string(),
                })
                .openapi("Workspace"),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "workspace:read"))
        return problem(c, 403, "insufficient_scope");
      const { workspace, actor } = c.get("principal");
      return c.json(
        {
          id: workspace._id.toHexString(),
          name: workspace.name,
          slug: workspace.slug,
          personal: workspace.personal,
          defaultDomain: workspace.defaultDomain,
          plan: c.get("entitlements").plan,
          role: actor.role,
          createdAt: (
            workspace.createdAt ?? workspace._id.getTimestamp()
          ).toISOString(),
        },
        200,
      );
    },
  );
  const usageMetric = z.object({
    consumed: z.number().int().nonnegative(),
    limit: z.number().nullable(),
    remaining: z.number().nullable(),
  });
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/workspace/usage",
      security,
      responses: {
        200: {
          description:
            "Monthly link/QR creation usage and current bio-page usage; null limits mean unlimited",
          content: {
            "application/json": {
              schema: z
                .object({
                  period: z.object({ start: z.string(), end: z.string() }),
                  links: usageMetric,
                  qrCodes: usageMetric,
                  bioPages: usageMetric,
                })
                .openapi("WorkspaceUsage"),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "workspace:read"))
        return problem(c, 403, "insufficient_scope");
      const service = c.get("service"),
        entitlements = c.get("entitlements");
      const usage = await countUsage(
        service.db,
        service.workspace,
        entitlements.period,
      );
      const metric = (name: "links" | "qrCodes" | "bioPages") => ({
        consumed: usage[name],
        limit: entitlements.limits[name],
        remaining:
          entitlements.limits[name] === null
            ? null
            : Math.max(0, entitlements.limits[name] - usage[name]),
      });
      return c.json(
        {
          period: {
            start: entitlements.period.start.toISOString(),
            end: entitlements.period.end.toISOString(),
          },
          links: metric("links"),
          qrCodes: metric("qrCodes"),
          bioPages: metric("bioPages"),
        },
        200,
      );
    },
  );
  const campaignInput = z
    .object({
      title: z.string().trim().min(1).max(80),
      description: z.string().max(5000).optional(),
    })
    .strict();
  const utmValues = z.array(z.string().max(200)).max(100);
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/campaigns",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
          search: z.string().max(200).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
      responses: {
        200: {
          description:
            "Campaigns in descending ID order, with bounded cursor pagination",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(campaignSchema),
                total: z.number().nullable(),
                nextCursor: z.string().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) =>
      c.json(await pageCampaigns(c.get("service"), c.req.valid("query")), 200),
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/campaigns/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description: "Campaign",
          content: { "application/json": { schema: campaignSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const campaign = await getCampaign(
        c.get("service"),
        c.req.valid("param").id,
      );
      return campaign ? c.json(campaign, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/campaigns",
      security,
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: campaignInput.openapi("CreateCampaign"),
            },
          },
        },
      },
      responses: {
        201: {
          description: "Created campaign",
          content: { "application/json": { schema: campaignSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createCampaign(
        c.get("service"),
        c.req.valid("json"),
      );
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/campaigns/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/campaigns/{id}",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: campaignInput
                .partial()
                .extend({
                  description: z.string().max(5000).nullable().optional(),
                  utmDefaults: z
                    .object({
                      sources: utmValues,
                      mediums: utmValues,
                      terms: utmValues,
                      contents: utmValues,
                    })
                    .strict()
                    .optional(),
                })
                .strict()
                .openapi("UpdateCampaign"),
            },
          },
        },
      },
      responses: {
        200: {
          description: "Updated campaign",
          content: { "application/json": { schema: campaignSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await updateCampaign(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/campaigns/{id}",
      security,
      request: { params: idParam },
      responses: {
        204: {
          description: "Campaign removed; linked short URLs are retained",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await deleteCampaign(
        c.get("service"),
        c.req.valid("param").id,
      );
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  const qrSchema = z
    .object({
      id: z.string(),
      publicId: z.string(),
      key: z.string(),
      shortUrl: z.string(),
      url: z.string(),
      title: z.string(),
      tags: z.array(z.object({ id: z.string(), name: z.string() })),
      scans: z.number(),
      lastScanAt: z.string().nullable(),
      design: qrDesignSchema,
      storedDesign: z.record(z.string(), z.unknown()),
      attachedLinkKey: z.string().nullable(),
      createdAt: z.string(),
      createdBy: z.string().nullable(),
    })
    .openapi("QrCode");
  const qrInput = z
    .object({
      url: z.string().max(8192),
      title: z.string().max(500).optional(),
      tags: z.array(z.string().max(48)).max(50).optional(),
      design: qrDesignSchema.optional(),
      attachToLinkId: z
        .string()
        .regex(/^[a-f\d]{24}$/i)
        .optional(),
    })
    .strict()
    .openapi("CreateQrCode");
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/qr-codes",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
          search: z.string().max(200).optional(),
          tag: z.union([z.string(), z.array(z.string())]).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
      responses: {
        200: {
          description:
            "QR codes in descending ID order with bounded cursor pagination",
          content: {
            "application/json": {
              schema: z.object({
                data: z.array(qrSchema),
                nextCursor: z.string().nullable(),
                total: z.number().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const query = c.req.valid("query");
      const page = await cursorQrs(c.get("service"), {
        cursor: query.cursor,
        search: query.search,
        limit: query.limit,
        tags: query.tag ? [query.tag].flat() : undefined,
      });
      return c.json(
        { data: page.items, nextCursor: page.nextCursor, total: page.total },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/qr-codes",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: qrInput } },
        },
      },
      responses: {
        201: {
          description: "QR code created with an independent backing short URL",
          content: { "application/json": { schema: qrSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createQr(c.get("service"), c.req.valid("json"));
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/qr-codes/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/qr-codes/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description: "Workspace-owned QR code",
          content: { "application/json": { schema: qrSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const qr = await getQr(c.get("service"), c.req.valid("param").id);
      return qr ? c.json(qr, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/qr-codes/export",
      security,
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z
                .object({
                  ids: z
                    .array(z.string().regex(/^[a-f0-9]{24}$/i))
                    .min(1)
                    .max(QR_ZIP_LIMIT),
                  format: z.enum(["svg", "png", "pdf"]).default("svg"),
                  size: z.number().int().min(128).max(4096).default(1024),
                })
                .strict(),
            },
          },
        },
      },
      responses: {
        202: {
          description: `ZIP job queued; up to ${QR_ZIP_LIMIT} selected QR codes, maximum ${QR_ZIP_MAX_BYTES} bytes`,
          content: { "application/json": { schema: qrZipSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      if (!deps.qrExports) return problem(c, 404, "feature_disabled");
      const result = await requestQrZip(c.get("service"), c.req.valid("json"));
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Cache-Control", "private, no-store");
      c.header("Location", `/v1/qr-exports/zip/${result.value.id}`);
      c.header("Retry-After", "1");
      return c.json(result.value, 202);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/qr-exports/zip/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description:
            "ZIP progress and private delivery; all selected QR codes must remain readable",
          content: { "application/json": { schema: qrZipSchema } },
        },
        503: failure,
        ...errors,
      },
    }),
    async (c) => {
      if (!deps.qrExports) return problem(c, 404, "feature_disabled");
      c.header("Cache-Control", "private, no-store");
      try {
        const result = await qrZipDelivery(
          c.get("service"),
          c.req.valid("param").id,
          deps.qrExports.sign,
        );
        if (!result) return problem(c, 404, "not_found");
        if (result.state === "pending" || result.state === "running")
          c.header("Retry-After", "1");
        return c.json(result, 200);
      } catch {
        return problem(c, 503, "storage_unavailable");
      }
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/qr-codes/{id}/export",
      security,
      request: {
        params: idParam,
        query: z.object({
          format: z.enum(["svg", "png", "pdf"]).default("svg"),
          size: z.coerce.number().int().min(128).max(4096).default(1024),
        }),
      },
      responses: {
        202: {
          description:
            "Export queued or rendering; poll Location with the same workspace credential",
          content: { "application/json": { schema: qrExportSchema } },
        },
        303: {
          description:
            "Export ready; Location is a private attachment URL expiring with the job",
        },
        503: failure,
        ...errors,
      },
    }),
    async (c) => {
      if (!deps.qrExports) return problem(c, 404, "feature_disabled");
      const result = await requestQrExport(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("query"),
      );
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Cache-Control", "private, no-store");
      c.header("Location", `/v1/qr-exports/${result.value.id}`);
      try {
        const delivery = await qrExportDelivery(
          c.get("service"),
          result.value.id,
          deps.qrExports.sign,
        );
        if (!delivery) return problem(c, 404, "not_found");
        if ("downloadUrl" in delivery)
          return c.redirect(delivery.downloadUrl, 303);
        if (delivery.state === "failed")
          return problem(c, 409, "export_failed", {
            jobId: delivery.id,
            reason: delivery.error ?? "failed",
          });
        c.header("Retry-After", "1");
        return c.json(delivery, 202);
      } catch {
        return problem(c, 503, "storage_unavailable");
      }
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/qr-exports/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description:
            "Authorized export status and, when ready, an expiring private download URL",
          content: { "application/json": { schema: qrExportSchema } },
        },
        503: failure,
        ...errors,
      },
    }),
    async (c) => {
      if (!deps.qrExports) return problem(c, 404, "feature_disabled");
      c.header("Cache-Control", "private, no-store");
      try {
        const delivery = await qrExportDelivery(
          c.get("service"),
          c.req.valid("param").id,
          deps.qrExports.sign,
        );
        if (!delivery) return problem(c, 404, "not_found");
        if (delivery.state === "pending" || delivery.state === "running")
          c.header("Retry-After", "1");
        return c.json(delivery, 200);
      } catch {
        return problem(c, 503, "storage_unavailable");
      }
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/qr-codes/{id}",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: qrInput
                .omit({ attachToLinkId: true })
                .partial()
                .extend({ applyToLink: z.boolean().optional() })
                .strict()
                .openapi("UpdateQrCode"),
            },
          },
        },
      },
      responses: {
        200: {
          description:
            "Updated QR code; applying changes to its attached link also requires links:write",
          content: { "application/json": { schema: qrSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const input = c.req.valid("json");
      if (input.applyToLink && !hasApiScope(c.get("principal"), "links:write"))
        return problem(c, 403, "insufficient_scope");
      const result = await updateQr(
        c.get("service"),
        c.req.valid("param").id,
        input,
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/qr-codes/{id}",
      security,
      request: { params: idParam },
      responses: {
        204: {
          description:
            "QR code and its independent backing link removed; attached links retained",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await deleteQrs(c.get("service"), [
        c.req.valid("param").id,
      ]);
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  const tagInput = z
    .object({ name: z.string().trim().min(1).max(48) })
    .strict()
    .openapi("WriteTag");
  const tagParam = z.object({ id: z.string().regex(/^[a-z\d_-]{1,64}$/i) });
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/tags",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
          search: z.string().max(200).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
      responses: {
        200: {
          description:
            "Workspace tags in descending ID order with cursor pagination",
          content: {
            "application/json": {
              schema: z.object({
                data: z.array(tagSchema),
                nextCursor: z.string().nullable(),
                total: z.number().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const page = await cursorTags(c.get("service"), c.req.valid("query"));
      return c.json(
        { data: page.items, nextCursor: page.nextCursor, total: page.total },
        200,
      );
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/tags",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: tagInput } },
        },
      },
      responses: {
        201: {
          description: "Workspace tag created",
          content: { "application/json": { schema: tagSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createTag(
        c.get("service"),
        c.req.valid("json").name,
      );
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/tags/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/tags/{id}",
      security,
      request: { params: tagParam },
      responses: {
        200: {
          description:
            "Workspace tag, accepting canonical or legacy identifiers",
          content: { "application/json": { schema: tagSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const tag = await getTag(c.get("service"), c.req.valid("param").id);
      return tag ? c.json(tag, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/tags/{id}",
      security,
      request: {
        params: tagParam,
        body: {
          required: true,
          content: { "application/json": { schema: tagInput } },
        },
      },
      responses: {
        200: {
          description: "Tag and its link/QR references renamed transactionally",
          content: { "application/json": { schema: tagSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await updateTag(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json").name,
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/tags/{id}",
      security,
      request: { params: tagParam },
      responses: {
        204: {
          description:
            "Tag removed from the workspace and its link/QR references",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await deleteTag(c.get("service"), c.req.valid("param").id);
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/analytics",
      security,
      request: { query: analyticsQuery },
      responses: analyticsResponses,
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "analytics:read"))
        return problem(c, 403, "insufficient_scope");
      const {
        groupBy,
        link,
        kind,
        from,
        to,
        timezone,
        interval,
        limit,
        ...filters
      } = c.req.valid("query");
      const result = await queryAnalytics(c.get("service"), {
        scope: { type: "workspace" },
        from,
        to,
        timezone,
        interval,
        limit,
        dimensions: groupBy ? [groupBy] : [],
        filters: Object.fromEntries(
          Object.entries({ ...filters, link, kind }).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      });
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/links/{id}/analytics",
      security,
      request: { query: analyticsQuery, params: idParam },
      responses: analyticsResponses,
    }),
    async (c) => {
      if (!hasApiScope(c.get("principal"), "analytics:read"))
        return problem(c, 403, "insufficient_scope");
      const {
        groupBy,
        link,
        kind,
        from,
        to,
        timezone,
        interval,
        limit,
        ...filters
      } = c.req.valid("query");
      const result = await queryAnalytics(c.get("service"), {
        scope: { type: "link", id: c.req.valid("param").id },
        from,
        to,
        timezone,
        interval,
        limit,
        dimensions: groupBy ? [groupBy] : [],
        filters: Object.fromEntries(
          Object.entries({ ...filters, link, kind }).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      });
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/domains",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          search: z.string().max(253).optional(),
        }),
      },
      responses: {
        200: {
          description: "Paginated workspace domains",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(domainSchema),
                nextCursor: z.string().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await cursorDomains(
        c.get("service"),
        c.req.valid("query"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/domains",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: addDomainSchema.strict() } },
        },
      },
      responses: {
        201: {
          description:
            "Hostname reserved for asynchronous verification; requires workspace owner and paid domain add-on",
          content: {
            "application/json": { schema: z.object({ id: z.string() }) },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await addDomain(
        c.get("service"),
        c.req.valid("json"),
        deps.linkDomain,
      );
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/domains/${result.value.id}/status`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/domains/{id}/status",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description:
            "Persisted hostname verification status; provider polling runs in the worker",
          content: { "application/json": { schema: domainSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const domain = await getDomain(c.get("service"), c.req.valid("param").id);
      return domain ? c.json(domain, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/domains/{id}",
      security,
      request: { params: idParam },
      responses: {
        204: {
          description:
            "Domain disabled immediately; provider removal is asynchronous",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await removeDomain(
        c.get("service"),
        c.req.valid("param").id,
      );
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/bio-pages",
      security,
      request: {
        query: z.object({
          cursor: z
            .string()
            .regex(/^[a-f\d]{24}$/i)
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          search: z.string().max(200).optional(),
        }),
      },
      responses: {
        200: {
          description: "Paginated bio page summaries",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(bioSummarySchema),
                nextCursor: z.string().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await cursorBioPages(
        c.get("service"),
        c.req.valid("query"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/bio-pages",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: createBioPageInput } },
        },
      },
      responses: {
        201: {
          description: "Created unpublished bio page",
          content: { "application/json": { schema: bioSummarySchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createBioPage(c.get("service"), c.req.valid("json"));
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/bio-pages/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/bio-pages/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description: "Current editable draft and revision",
          content: { "application/json": { schema: bioDraftSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const draft = await readBioDraft(
        c.get("service"),
        c.req.valid("param").id,
      );
      return draft ? c.json(draft, 200) : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/bio-pages/{id}",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: { "application/json": { schema: bioDraftPatchInput } },
        },
      },
      responses: {
        200: {
          description:
            "Updated draft revision; blocks replace the ordered list, theme and SEO merge provided fields",
          content: { "application/json": { schema: bioRevisionSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await patchBioDraft(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/bio-pages/{id}/publish",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: {
            "application/json": { schema: bioRevisionSchema.strict() },
          },
        },
      },
      responses: {
        200: {
          description:
            "Published validated revision; durable invalidation job queued transactionally",
          content: { "application/json": { schema: bioRevisionSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await publishBioDraft(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json").revision,
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/webhooks",
      security,
      request: { query: webhookPageQuery },
      responses: {
        200: {
          description: "Paginated webhook metadata; signing secrets omitted",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(webhookSchema),
                nextCursor: z.string().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await listWebhooks(c.get("service"), c.req.valid("query"));
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/webhooks",
      security,
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: webhookInput } },
        },
      },
      responses: {
        201: {
          description:
            "Endpoint created with signing secret; retain it securely",
          content: {
            "application/json": {
              schema: webhookSchema.extend({ secret: z.string() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await createWebhook(
        c.get("service"),
        c.req.valid("json"),
        webhookConfig,
      );
      if (!result.ok)
        return problem(c, serviceErrorStatus(result.error), result.error);
      c.header("Location", `/v1/webhooks/${result.value.id}`);
      return c.json(result.value, 201);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/webhooks/{id}",
      security,
      request: { params: idParam },
      responses: {
        200: {
          description: "Webhook metadata",
          content: { "application/json": { schema: webhookSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const endpoint = await getWebhook(
        c.get("service"),
        c.req.valid("param").id,
      );
      return endpoint
        ? c.json(webhookView(endpoint), 200)
        : problem(c, 404, "not_found");
    },
  );
  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/webhooks/{id}",
      security,
      request: {
        params: idParam,
        body: {
          required: true,
          content: { "application/json": { schema: webhookPatchInput } },
        },
      },
      responses: {
        200: {
          description: "Updated webhook",
          content: { "application/json": { schema: webhookSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await updateWebhook(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("json"),
        webhookConfig,
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/webhooks/{id}",
      security,
      request: { params: idParam },
      responses: {
        204: {
          description:
            "Endpoint removed; queued deliveries cancel before sending",
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await deleteWebhook(
        c.get("service"),
        c.req.valid("param").id,
      );
      return result.ok
        ? c.body(null, 204)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/webhooks/{id}/test",
      security,
      request: { params: idParam },
      responses: {
        202: {
          description: "Test delivery persisted for the worker",
          content: { "application/json": { schema: queuedWebhookSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await testWebhook(
        c.get("service"),
        c.req.valid("param").id,
        webhookConfig,
      );
      return result.ok
        ? c.json(result.value, 202)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/webhooks/{id}/deliveries",
      security,
      request: {
        params: idParam,
        query: webhookPageQuery.omit({ search: true }),
      },
      responses: {
        200: {
          description: "30-day paginated delivery log",
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(webhookDeliverySchema),
                nextCursor: z.string().nullable(),
              }),
            },
          },
        },
        ...errors,
      },
    }),
    async (c) => {
      const result = await listWebhookDeliveries(
        c.get("service"),
        c.req.valid("param").id,
        c.req.valid("query"),
      );
      return result.ok
        ? c.json(result.value, 200)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/webhooks/{id}/deliveries/{deliveryId}/redeliver",
      security,
      request: {
        params: idParam.extend({
          deliveryId: z.string().regex(/^[a-f\d]{24}$/i),
        }),
      },
      responses: {
        202: {
          description: "New delivery queued with the original event ID",
          content: { "application/json": { schema: queuedWebhookSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { id, deliveryId } = c.req.valid("param");
      const result = await redeliverWebhook(
        c.get("service"),
        id,
        deliveryId,
        webhookConfig,
      );
      return result.ok
        ? c.json(result.value, 202)
        : problem(c, serviceErrorStatus(result.error), result.error);
    },
  );
  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Shortn API", version: "1.0.0" },
  });
  app.route("/", createDocumentationApp({ liveSpec: true, apiRoot: true }));
  app.notFound((c) => problem(c, 404, "not_found"));
  app.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400)
      return problem(c, 400, "invalid_input");
    deps.log("REST request failed", error);
    return problem(c, 500, "internal_error");
  });
  return app;
}

function serviceErrorStatus(error: string): 400 | 403 | 404 | 409 {
  if (
    error === "forbidden" ||
    error === "feature_required" ||
    error === "addon_required" ||
    error === "feature_disabled" ||
    error === "taken_down" ||
    error === "admin_disabled" ||
    error === "domain_suspended"
  )
    return 403;
  if (error === "not_found") return 404;
  if (
    error === "key_taken" ||
    error === "limit_reached" ||
    error === "title_taken" ||
    error === "name_taken" ||
    error === "hostname_taken" ||
    error === "slug_taken" ||
    error === "bio_domain_taken" ||
    error === "endpoint_disabled" ||
    error === "conflict"
  )
    return 409;
  return 400;
}
