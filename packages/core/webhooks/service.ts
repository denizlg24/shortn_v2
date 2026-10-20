import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  createHmac,
} from "node:crypto";
import { ObjectId, type Db, type Document, type ClientSession } from "mongodb";
import { physicalNames } from "@shortn/db";
import { z } from "zod";
import { can } from "../workspaces/authz";
import { nowOf, type ServiceContext } from "../workspaces/context";
import { platformFeatureEnabled } from "../platform/features";
import { parseObjectId } from "../workspaces/service";
import { fail, ok } from "../result";

export const webhookEvents = [
  "link.created",
  "link.updated",
  "link.deleted",
  "link.clicked",
  "qr.scanned",
  "bio.published",
  "domain.verified",
  "import.completed",
] as const;
export type WebhookEvent = (typeof webhookEvents)[number] | "webhook.test";
export interface WebhookConfig {
  enabled: boolean;
  secretKey: string;
  rolloutPercent?: number;
}
export interface WebhookEndpoint {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  url: string;
  events: (typeof webhookEvents)[number][];
  enabled: boolean;
  secret: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  failureSince?: Date;
  disabledAt?: Date;
  adminDisabled?: { at: Date; by: string; reason: string };
}
export interface WebhookEnvelope {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  workspaceId: string;
  data: Record<string, unknown>;
}
export interface WebhookDelivery {
  _id: ObjectId;
  workspaceId: ObjectId;
  webhookId: ObjectId;
  event: WebhookEnvelope;
  status: "pending" | "sending" | "delivered" | "failed" | "cancelled";
  attempts: number;
  createdAt: Date;
  nextAttemptAt: Date;
  retryUntil: Date;
  expiresAt: Date;
  leaseUntil?: Date;
  leaseToken?: string;
  deliveredAt?: Date;
  lastStatus?: number;
  lastError?: string;
  redeliveryOf?: ObjectId;
  automatic?: boolean;
}
export const endpoints = (db: Db) =>
  db.collection<WebhookEndpoint>(physicalNames.webhook_endpoints);
export const deliveries = (db: Db) =>
  db.collection<WebhookDelivery>(physicalNames.webhook_deliveries);
export function sealWebhookSecret(secret: string, key: string) {
  if (key.length < 32)
    throw new Error(
      "Webhook encryption key must contain at least 32 characters",
    );
  const iv = randomBytes(12),
    cipher = createCipheriv(
      "aes-256-gcm",
      createHash("sha256").update(key).digest(),
      iv,
    );
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function openWebhookSecret(sealed: string, key: string) {
  if (key.length < 32)
    throw new Error(
      "Webhook encryption key must contain at least 32 characters",
    );
  const parts = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  if (parts.length !== 3 || parts[0]!.length !== 12 || parts[1]!.length !== 16)
    throw new Error("Invalid webhook signing secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(key).digest(),
    parts[0]!,
  );
  decipher.setAuthTag(parts[1]!);
  return Buffer.concat([decipher.update(parts[2]!), decipher.final()]).toString(
    "utf8",
  );
}
export const webhookSignature = (
  secret: string,
  timestamp: number,
  body: string,
) =>
  `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
export const webhookInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: z
      .url({ protocol: /^https$/ })
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return (
          !url.username &&
          !url.password &&
          !url.hash &&
          url.hostname !== "localhost" &&
          !url.hostname.endsWith(".localhost")
        );
      }, "Use an HTTPS endpoint without credentials or a fragment"),
    events: z
      .array(z.enum(webhookEvents))
      .min(1)
      .max(webhookEvents.length)
      .refine((events) => new Set(events).size === events.length),
    enabled: z.boolean().default(true),
  })
  .strict();
export const webhookPatchInput = webhookInput
  .omit({ enabled: true })
  .partial()
  .extend({ enabled: z.boolean().optional() })
  .strict();
export function webhookView(endpoint: WebhookEndpoint) {
  return {
    id: endpoint._id.toHexString(),
    name: endpoint.name,
    url: endpoint.url,
    events: endpoint.events,
    enabled: endpoint.enabled,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
    failureSince: endpoint.failureSince?.toISOString() ?? null,
    disabledAt: endpoint.disabledAt?.toISOString() ?? null,
    adminDisabled: endpoint.adminDisabled
      ? {
          at: endpoint.adminDisabled.at.toISOString(),
          reason: endpoint.adminDisabled.reason,
        }
      : null,
  };
}
export function webhookWritable(ctx: ServiceContext, config: WebhookConfig) {
  if (!can(ctx.actor, "webhooks.manage")) return fail("forbidden");
  if (
    !config.enabled ||
    config.secretKey.length < 32 ||
    !platformFeatureEnabled(ctx.workspace, "webhooks", config.rolloutPercent)
  )
    return fail("feature_disabled");
  return null;
}
export async function getWebhook(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "webhooks.manage")) return null;
  const _id = parseObjectId(id);
  return _id
    ? endpoints(ctx.db).findOne({ _id, workspaceId: ctx.workspace._id })
    : null;
}
const pageInput = z.object({
  cursor: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  limit: z.number().int().min(1).max(200).default(50),
  search: z.string().max(200).optional(),
});
export async function listWebhooks(
  ctx: ServiceContext,
  input: z.input<typeof pageInput> = {},
) {
  if (!can(ctx.actor, "webhooks.manage")) return fail("forbidden");
  const parsed = pageInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { cursor, limit, search } = parsed.data;
  const query: Document = { workspaceId: ctx.workspace._id };
  if (cursor) query._id = { $lt: new ObjectId(cursor) };
  if (search) {
    const literal = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
    query.$or = [{ name: literal }, { url: literal }];
  }
  const rows = await endpoints(ctx.db)
    .find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  return ok({
    items: rows.slice(0, limit).map(webhookView),
    nextCursor: rows.length > limit ? rows[limit - 1]!._id.toHexString() : null,
  });
}
export async function createWebhook(
  ctx: ServiceContext,
  input: unknown,
  config: WebhookConfig,
) {
  const blocked = webhookWritable(ctx, config);
  if (blocked) return blocked;
  const parsed = webhookInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const secret = `whsec_${randomBytes(32).toString("base64url")}`,
    now = nowOf(ctx);
  const endpoint: WebhookEndpoint = {
    _id: new ObjectId(),
    workspaceId: ctx.workspace._id,
    ...parsed.data,
    secret: sealWebhookSecret(secret, config.secretKey),
    createdBy: ctx.actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await endpoints(ctx.db).insertOne(endpoint);
  return ok({ ...webhookView(endpoint), secret });
}
export async function updateWebhook(
  ctx: ServiceContext,
  id: string,
  input: unknown,
  config: WebhookConfig,
) {
  const blocked = webhookWritable(ctx, config);
  if (blocked) return blocked;
  const parsed = webhookPatchInput.safeParse(input);
  if (!parsed.success || !Object.keys(parsed.data).length)
    return fail("invalid_input");
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found");
  const set: Document = {
    ...Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined),
    ),
    updatedAt: nowOf(ctx),
  };
  const enabling = parsed.data.enabled === true;
  const endpoint = await endpoints(ctx.db).findOneAndUpdate(
    {
      _id,
      workspaceId: ctx.workspace._id,
      // Staff disabled it; only staff can lift that (23 §3.9).
      ...(enabling ? { adminDisabled: { $exists: false } } : {}),
    },
    {
      $set: set,
      ...(enabling ? { $unset: { disabledAt: "", failureSince: "" } } : {}),
    },
    { returnDocument: "after" },
  );
  if (endpoint) return ok(webhookView(endpoint));
  if (
    enabling &&
    (await endpoints(ctx.db).findOne(
      { _id, workspaceId: ctx.workspace._id },
      { projection: { _id: 1 } },
    ))
  )
    return fail("admin_disabled");
  return fail("not_found");
}
export async function deleteWebhook(ctx: ServiceContext, id: string) {
  if (!can(ctx.actor, "webhooks.manage")) return fail("forbidden");
  const _id = parseObjectId(id);
  if (!_id) return fail("not_found");
  const result = await endpoints(ctx.db).deleteOne({
    _id,
    workspaceId: ctx.workspace._id,
  });
  return result.deletedCount ? ok({ id }) : fail("not_found");
}
export async function queueWebhookDelivery(
  db: Db,
  endpoint: WebhookEndpoint,
  event: WebhookEnvelope,
  now = new Date(),
  redeliveryOf?: ObjectId,
  options: { session?: ClientSession; automatic?: boolean } = {},
) {
  if (event.workspaceId !== endpoint.workspaceId.toHexString())
    throw new Error("Webhook event workspace mismatch");
  if (Buffer.byteLength(JSON.stringify(event)) > 262144)
    throw new Error("Webhook event exceeds 256 KB");
  const delivery: WebhookDelivery = {
    _id: new ObjectId(),
    workspaceId: endpoint.workspaceId,
    webhookId: endpoint._id,
    event,
    status: "pending",
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
    retryUntil: new Date(now.getTime() + 86400000),
    expiresAt: new Date(now.getTime() + 30 * 86400000),
    ...(redeliveryOf ? { redeliveryOf } : {}),
    ...(options.automatic ? { automatic: true } : {}),
  };
  const saved = options.automatic
    ? await deliveries(db).findOneAndUpdate(
        { webhookId: endpoint._id, "event.id": event.id, automatic: true },
        { $setOnInsert: delivery },
        {
          ...(options.session ? { session: options.session } : {}),
          upsert: true,
          returnDocument: "after",
        },
      )
    : (await deliveries(db).insertOne(
        delivery,
        options.session ? { session: options.session } : {},
      ),
      delivery);
  if (!saved) throw new Error("Webhook delivery reservation vanished");
  return {
    id: saved._id.toHexString(),
    eventId: event.id,
    status: saved.status,
  };
}
export async function testWebhook(
  ctx: ServiceContext,
  id: string,
  config: WebhookConfig,
) {
  const blocked = webhookWritable(ctx, config);
  if (blocked) return blocked;
  const endpoint = await getWebhook(ctx, id);
  if (!endpoint) return fail("not_found");
  if (!endpoint.enabled) return fail("endpoint_disabled");
  const now = nowOf(ctx);
  return ok(
    await queueWebhookDelivery(
      ctx.db,
      endpoint,
      {
        id: randomUUID(),
        type: "webhook.test",
        workspaceId: ctx.workspace._id.toHexString(),
        createdAt: now.toISOString(),
        data: {},
      },
      now,
    ),
  );
}
export async function listWebhookDeliveries(
  ctx: ServiceContext,
  id: string,
  input: z.input<typeof pageInput> = {},
) {
  if (!can(ctx.actor, "webhooks.manage")) return fail("forbidden");
  const endpoint = await getWebhook(ctx, id);
  if (!endpoint) return fail("not_found");
  const parsed = pageInput.safeParse(input);
  if (!parsed.success) return fail("invalid_input");
  const { cursor, limit } = parsed.data;
  const rows = await deliveries(ctx.db)
    .find({
      webhookId: endpoint._id,
      workspaceId: ctx.workspace._id,
      expiresAt: { $gt: nowOf(ctx) },
      ...(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {}),
    })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .toArray();
  return ok({
    items: rows.slice(0, limit).map((d) => ({
      id: d._id.toHexString(),
      eventId: d.event.id,
      type: d.event.type,
      status: d.status,
      attempts: d.attempts,
      createdAt: d.createdAt.toISOString(),
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
      lastStatus: d.lastStatus ?? null,
      lastError: d.lastError ?? null,
    })),
    nextCursor: rows.length > limit ? rows[limit - 1]!._id.toHexString() : null,
  });
}
export async function redeliverWebhook(
  ctx: ServiceContext,
  id: string,
  deliveryId: string,
  config: WebhookConfig,
) {
  const blocked = webhookWritable(ctx, config);
  if (blocked) return blocked;
  const endpoint = await getWebhook(ctx, id),
    _id = parseObjectId(deliveryId);
  if (!endpoint || !_id) return fail("not_found");
  if (!endpoint.enabled) return fail("endpoint_disabled");
  const delivery = await deliveries(ctx.db).findOne({
    _id,
    webhookId: endpoint._id,
    workspaceId: ctx.workspace._id,
    expiresAt: { $gt: nowOf(ctx) },
  });
  if (!delivery) return fail("not_found");
  return ok(
    await queueWebhookDelivery(
      ctx.db,
      endpoint,
      delivery.event,
      nowOf(ctx),
      _id,
    ),
  );
}
