import { physicalNames, collection } from "@shortn/db";
import {
  endpoints,
  platformFeatureEnabled,
  recordWebhookEvent,
  withMutation,
  type WebhookConfig,
} from "@shortn/core";
import { ObjectId, type Db } from "mongodb";
import type { Decoded } from "./ingest";

type CaptureConfig = Pick<WebhookConfig, "enabled" | "rolloutPercent">;
interface ClickReceipt {
  _id: ObjectId;
  sid: string;
  workspaceId: ObjectId;
  type: "link.clicked" | "qr.scanned";
  receivedAt: Date;
  data: {
    id: string;
    linkId: string;
    qrId?: string;
    timestamp: string;
    domain: string;
    key: string;
  };
  completedAt?: Date;
  expiresAt?: Date;
}
const receipts = (db: Db) =>
  db.collection<ClickReceipt>(physicalNames.webhook_clicks);

// Called before XACK, including replayed analytics entries. A stream id is the
// durable deduplication key; raw visitor data never enters webhook storage.
export async function captureWebhookClicks(
  db: Db,
  decoded: Decoded[],
  config: CaptureConfig,
  now = new Date(),
) {
  if (!config.enabled || !decoded.length) return;
  const humans = decoded.filter(({ message }) => !message.bot);
  for (let offset = 0; offset < humans.length; offset += 500) {
    const page = humans.slice(offset, offset + 500);
    const links = await collection(db, "links")
      .find(
        {
          _id: { $in: page.map(({ message }) => new ObjectId(message.linkId)) },
        },
        { projection: { _id: 1, workspaceId: 1, sub: 1, urlCode: 1 } },
      )
      .toArray();
    const byId = new Map(links.map((link) => [link._id.toHexString(), link]));
    const subs = links.flatMap((link) =>
      !link.workspaceId && link.sub ? [link.sub] : [],
    );
    const workspaces = await collection(db, "workspaces")
      .find({
        $or: [
          {
            _id: {
              $in: links.flatMap((link) =>
                link.workspaceId ? [link.workspaceId] : [],
              ),
            },
          },
          { personal: true, legacySub: { $in: subs } },
        ],
      })
      .toArray();
    const byWorkspace = new Map(
      workspaces.map((workspace) => [workspace._id.toHexString(), workspace]),
    );
    const bySub = new Map(
      workspaces
        .filter((workspace) => workspace.personal && workspace.legacySub)
        .map((workspace) => [workspace.legacySub!, workspace]),
    );
    const subscribers = await endpoints(db)
      .aggregate<{ _id: { workspaceId: ObjectId; type: string } }>([
        {
          $match: {
            workspaceId: { $in: workspaces.map((workspace) => workspace._id) },
            enabled: true,
            events: { $in: ["link.clicked", "qr.scanned"] },
          },
        },
        { $unwind: "$events" },
        { $match: { events: { $in: ["link.clicked", "qr.scanned"] } } },
        { $group: { _id: { workspaceId: "$workspaceId", type: "$events" } } },
      ])
      .toArray();
    const subscribed = new Set(
      subscribers.map((row) => `${row._id.workspaceId}:${row._id.type}`),
    );
    const qrIds = page.flatMap(({ message }) =>
      message.qrId ? [new ObjectId(message.qrId)] : [],
    );
    const qrs = qrIds.length
      ? await collection(db, "qr_codes")
          .find(
            { _id: { $in: qrIds } },
            {
              projection: {
                _id: 1,
                workspaceId: 1,
                sub: 1,
                linkId: 1,
                urlId: 1,
              },
            },
          )
          .toArray()
      : [];
    const qrById = new Map(qrs.map((qr) => [qr._id.toHexString(), qr]));
    const ops = page.flatMap(({ sid, message }) => {
      const link = byId.get(message.linkId);
      if (!link) return [];
      const workspace = link.workspaceId
        ? byWorkspace.get(link.workspaceId.toHexString())
        : bySub.get(link.sub ?? "");
      const type = message.qrId
        ? ("qr.scanned" as const)
        : ("link.clicked" as const);
      if (
        !workspace ||
        !platformFeatureEnabled(workspace, "webhooks", config.rolloutPercent) ||
        !subscribed.has(`${workspace._id}:${type}`)
      )
        return [];
      if (message.qrId) {
        const qr = qrById.get(message.qrId);
        if (
          !qr ||
          (qr.linkId
            ? !qr.linkId.equals(link._id)
            : !qr.urlId || qr.urlId !== link.urlCode) ||
          (qr.workspaceId
            ? !qr.workspaceId.equals(workspace._id)
            : qr.sub !== link.sub)
        )
          return [];
      }
      const doc: ClickReceipt = {
        _id: new ObjectId(),
        sid,
        workspaceId: workspace._id,
        type,
        receivedAt: now,
        data: {
          id: sid,
          linkId: message.linkId,
          ...(message.qrId ? { qrId: message.qrId } : {}),
          timestamp: new Date(message.ts).toISOString(),
          domain: message.domain.slice(0, 253),
          key: message.key.slice(0, 200),
        },
      };
      return [
        {
          updateOne: {
            filter: { sid },
            update: { $setOnInsert: doc },
            upsert: true,
          },
        },
      ];
    });
    if (ops.length)
      await receipts(db).bulkWrite(ops, {
        ordered: false,
        writeConcern: { w: "majority" },
      });
  }
}

export async function flushWebhookClicks(
  db: Db,
  config: CaptureConfig,
  now = new Date(),
) {
  if (!config.enabled) return;
  const groups = await receipts(db)
    .aggregate<{ workspaceId: ObjectId; type: ClickReceipt["type"] }>([
      { $match: { completedAt: { $exists: false } } },
      {
        $group: {
          _id: { workspaceId: "$workspaceId", type: "$type" },
          oldest: { $min: "$receivedAt" },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          $or: [
            { count: { $gte: 100 } },
            { oldest: { $lte: new Date(now.getTime() - 10000) } },
          ],
        },
      },
      { $sort: { oldest: 1, "_id.workspaceId": 1, "_id.type": 1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          workspaceId: "$_id.workspaceId",
          type: "$_id.type",
        },
      },
    ])
    .toArray();
  // Round-robin groups with at most 2,000 receipts per pump. A busy workspace
  // can drain multiple full batches without keeping other due groups waiting.
  for (let budget = 0; budget < 20 && groups.length; budget++) {
    const candidate = groups.shift()!;
    const more = await withMutation(db, async (session) => {
      const rows = await receipts(db)
        .find(
          {
            workspaceId: candidate.workspaceId,
            type: candidate.type,
            completedAt: { $exists: false },
          },
          { session },
        )
        .sort({ receivedAt: 1, _id: 1 })
        .limit(100)
        .toArray();
      if (
        !rows.length ||
        (rows.length < 100 &&
          rows[0]!.receivedAt.getTime() > now.getTime() - 10000)
      )
        return false;
      const workspace = await collection(db, "workspaces").findOne(
        { _id: candidate.workspaceId },
        { session },
      );
      if (
        workspace &&
        platformFeatureEnabled(workspace, "webhooks", config.rolloutPercent)
      )
        await recordWebhookEvent(
          db,
          candidate.workspaceId,
          candidate.type,
          { count: rows.length, events: rows.map((row) => row.data) },
          session,
          rows[0]!.receivedAt,
        );
      await receipts(db).updateMany(
        { _id: { $in: rows.map((row) => row._id) } },
        {
          $set: {
            completedAt: now,
            expiresAt: new Date(now.getTime() + 30 * 86400000),
          },
        },
        { session },
      );
      return rows.length === 100;
    });
    if (more) groups.push(candidate);
  }
}
