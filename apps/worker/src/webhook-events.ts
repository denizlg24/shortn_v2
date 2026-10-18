import { collection } from "@shortn/db";
import type { Db } from "mongodb";
import {
  endpoints,
  queueWebhookDelivery,
  webhookOutbox,
  withMutation,
  platformFeatureEnabled,
  type WebhookConfig,
} from "@shortn/core";

// Each transaction advances one recipient page together with its delivery rows.
// Concurrent/restarted workers cannot skip a page or duplicate automatic deliveries.
export async function fanoutWebhookEvents(
  db: Db,
  config: WebhookConfig,
  now = new Date(),
  pageSize = 100,
) {
  if (!config.enabled) return;
  const limit = Number.isFinite(pageSize)
    ? Math.min(200, Math.max(1, Math.floor(pageSize)))
    : 100;
  const pending = await webhookOutbox(db)
    .find({ completedAt: { $exists: false } })
    .sort({ _id: 1 })
    .limit(20)
    .toArray();
  for (const candidate of pending)
    await withMutation(db, async (session) => {
      const current = await webhookOutbox(db).findOne(
        { _id: candidate._id, completedAt: { $exists: false } },
        { session },
      );
      if (!current) return;
      const workspace = await collection(db, "workspaces").findOne(
        { _id: current.workspaceId },
        { session },
      );
      const allowed =
        workspace &&
        platformFeatureEnabled(workspace, "webhooks", config.rolloutPercent);
      const type = current.event.type;
      const rows =
        allowed && type !== "webhook.test"
          ? await endpoints(db)
              .find(
                {
                  workspaceId: current.workspaceId,
                  enabled: true,
                  events: type,
                  createdAt: { $lte: current.createdAt },
                  ...(current.cursor ? { _id: { $gt: current.cursor } } : {}),
                },
                { session },
              )
              .sort({ _id: 1 })
              .limit(limit)
              .toArray()
          : [];
      for (const endpoint of rows)
        await queueWebhookDelivery(
          db,
          endpoint,
          current.event,
          now,
          undefined,
          { session, automatic: true },
        );
      await webhookOutbox(db).updateOne(
        { _id: current._id },
        {
          $set: {
            ...(rows.length ? { cursor: rows[rows.length - 1]!._id } : {}),
            ...(rows.length < limit
              ? {
                  completedAt: now,
                  expiresAt: new Date(now.getTime() + 30 * 86400000),
                }
              : {}),
          },
        },
        { session },
      );
    });
}
