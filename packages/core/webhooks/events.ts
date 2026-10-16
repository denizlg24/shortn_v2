import { randomUUID } from "node:crypto";
import { ObjectId, type ClientSession, type Db } from "mongodb";
import { physicalNames, type Documents } from "@shortn/db";
import { endpoints, type WebhookEnvelope, type WebhookEvent } from "./service";

export interface WebhookOutboxEvent {
  _id: ObjectId;
  workspaceId: ObjectId;
  event: WebhookEnvelope;
  createdAt: Date;
  cursor?: ObjectId;
  completedAt?: Date;
  expiresAt?: Date;
}
export const webhookOutbox = (db: Db) =>
  db.collection<WebhookOutboxEvent>(physicalNames.webhook_events);
export async function withMutation<T>(
  db: Db,
  action: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = db.client.startSession();
  try {
    return await session.withTransaction(() => action(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
}
// Producers pass the mutation's session: an event can never outlive a rollback.
// No subscribers means no outbox write. Worker feature gates still apply at send time.
export async function recordWebhookEvent(
  db: Db,
  workspaceId: ObjectId,
  type: Exclude<WebhookEvent, "webhook.test">,
  data: Record<string, unknown>,
  session: ClientSession,
  now = new Date(),
) {
  if (!session.inTransaction())
    throw new Error("Webhook mutation events require a transaction");
  const subscribed = await endpoints(db).findOne(
    {
      workspaceId,
      enabled: true,
      events: type,
    },
    { session, projection: { _id: 1 } },
  );
  if (!subscribed) return;
  const event: WebhookEnvelope = {
    id: randomUUID(),
    type,
    workspaceId: workspaceId.toHexString(),
    createdAt: now.toISOString(),
    data,
  };
  if (Buffer.byteLength(JSON.stringify(event)) > 262144)
    throw new Error("Webhook event exceeds 256 KB");
  await webhookOutbox(db).insertOne(
    { _id: new ObjectId(), workspaceId, event, createdAt: now },
    { session },
  );
}
/** Batch mutations retain per-resource envelopes with one subscription query/write. */
export async function recordWebhookEvents(
  db: Db,
  workspaceId: ObjectId,
  entries: {
    type: Exclude<WebhookEvent, "webhook.test">;
    data: Record<string, unknown>;
  }[],
  session: ClientSession,
  now = new Date(),
) {
  if (!session.inTransaction())
    throw new Error("Webhook mutation events require a transaction");
  if (!entries.length) return;
  const subscribed = new Set(
    await endpoints(db).distinct(
      "events",
      {
        workspaceId,
        enabled: true,
        events: { $in: [...new Set(entries.map((entry) => entry.type))] },
      },
      { session },
    ),
  );
  const documents = entries.flatMap((entry) => {
    if (!subscribed.has(entry.type)) return [];
    const event: WebhookEnvelope = {
      id: randomUUID(),
      type: entry.type,
      workspaceId: workspaceId.toHexString(),
      createdAt: now.toISOString(),
      data: entry.data,
    };
    if (Buffer.byteLength(JSON.stringify(event)) > 262144)
      throw new Error("Webhook event exceeds 256 KB");
    return [{ _id: new ObjectId(), workspaceId, event, createdAt: now }];
  });
  if (documents.length)
    await webhookOutbox(db).insertMany(documents, { session });
}
export function linkEventData(
  link: Documents["links"],
  defaultDomain: string,
): Record<string, unknown> {
  // Explicit allowlist: never serialize raw link documents, password hashes/hints,
  // safety reports, identity fields, legacy IPs or internal sync metadata.
  return {
    id: link._id.toHexString(),
    domain: link.domain ?? defaultDomain,
    key: link.key ?? link.urlCode ?? "",
    url: link.destination ?? link.longUrl ?? "",
    title: link.title ?? "",
    deletedAt: link.deletedAt?.toISOString() ?? null,
  };
}
