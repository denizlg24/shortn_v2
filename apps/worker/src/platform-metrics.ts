import { createHash } from "node:crypto";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { paidStatuses, plans, type PlanId } from "@shortn/billing";
import type { Redis } from "ioredis";
import { ObjectId, type Db, type Document } from "mongodb";

const dayMs = 86_400_000;
export function utcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Replaces a complete UTC day's derived counters. No increments: retries are safe. */
export async function computePlatformDay(
  db: Db,
  day: Date,
  now = new Date(),
  bots?: Pick<Redis, "hvals">,
) {
  const start = utcDay(day);
  const end = new Date(start.getTime() + dayMs);
  const range = { $gte: start, $lt: end };
  const ids = {
    $gte: ObjectId.createFromTime(start.getTime() / 1000),
    $lt: ObjectId.createFromTime(end.getTime() / 1000),
  };
  const count = (name: keyof typeof physicalNames, match: Document) =>
    db.collection(physicalNames[name]).countDocuments(match);
  const [
    signups,
    verified,
    personal,
    team,
    links,
    demo,
    qr,
    clicks,
    rejects,
    bioViews,
    opened,
    resolved,
    takedowns,
    suspensions,
    bans,
    webhooks,
  ] = await Promise.all([
    count("user", { _id: ids }),
    count("user", { _id: ids, emailVerified: true }),
    count("workspaces", { _id: ids, personal: true }),
    count("workspaces", { _id: ids, personal: false }),
    count("links", { _id: ids }),
    count("links", { _id: ids, demo: true }),
    count("qr_codes", { _id: ids }),
    collection(db, "click_rollups")
      .aggregate<{ _id: null; human: number; scans: number }>([
        { $match: { day: start } },
        {
          $group: {
            _id: null,
            human: { $sum: "$clicks" },
            scans: { $sum: "$scans" },
          },
        },
      ])
      .next(),
    count("click_rejects", { at: range }),
    count("bio_views", { ts: range }),
    count("link_reports", { createdAt: range }),
    count("link_reports", { resolvedAt: range }),
    count("admin_audit_log", {
      action: "link.takedown",
      status: "succeeded",
      createdAt: range,
    }),
    count("admin_audit_log", {
      action: "workspace.suspend",
      status: "succeeded",
      createdAt: range,
    }),
    count("admin_audit_log", {
      action: "user.ban",
      status: "succeeded",
      createdAt: range,
    }),
    collection(db, "webhook_attempts")
      .aggregate<{ _id: null; attempts: number; failures: number }>([
        { $match: { createdAt: range } },
        {
          $group: {
            _id: null,
            attempts: { $sum: 1 },
            failures: {
              $sum: {
                $cond: [
                  {
                    $or: [{ $eq: ["$status", 0] }, { $gte: ["$status", 400] }],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .next(),
  ]);
  const daily: Documents["platform_daily"] = {
    _id: start.toISOString().slice(0, 10),
    computedAt: now,
    users: { signups, verified },
    workspaces: { personal, team },
    links: { created: links, demo },
    qr: { created: qr },
    clicks: { human: clicks?.human ?? 0, scans: clicks?.scans ?? 0 },
    rejects,
    bioViews,
    reports: { opened, resolved },
    moderation: { takedowns, suspensions, bans },
    webhooks: {
      attempts: webhooks?.attempts ?? 0,
      failures: webhooks?.failures ?? 0,
    },
  };
  const jobKinds = {
    imports: "import_jobs",
    exports: "export_jobs",
    qr: "qr_export_jobs",
    zips: "qr_zip_jobs",
  } as const;
  daily.jobs = {};
  for (const [kind, name] of Object.entries(jobKinds))
    daily.jobs[kind] = {
      created: await count(name, { _id: ids }),
      failed: await count(name, { _id: ids, state: "failed" }),
    };
  if (start.getTime() === utcDay(now).getTime()) {
    const [subs, addons] = await Promise.all([
      collection(db, "subscriptions")
        .aggregate<{ _id: PlanId; count: number }>([
          { $match: { status: { $in: paidStatuses } } },
          { $group: { _id: "$plan", count: { $sum: 1 } } },
        ])
        .toArray(),
      count("domain_addons", { status: { $in: paidStatuses } }),
    ]);
    daily.billing = {
      activeByPlan: Object.fromEntries(subs.map((s) => [s._id, s.count])),
      addons,
      newPaid: await count("billing_events", {
        type: "subscription.active",
        receivedAt: range,
      }),
      canceled: await count("billing_events", {
        type: "subscription.canceled",
        receivedAt: range,
      }),
      mrrListUsd: subs.reduce(
        (n, s) => n + (plans[s._id]?.priceUsdMonthly ?? 0) * s.count,
        addons * 5,
      ),
    };
  }
  if (bots && daily.clicks)
    daily.clicks.bots = (await bots.hvals(`bots:${daily._id}`)).reduce(
      (total, n) => total + (Number(n) || 0),
      0,
    );
  // Stream grouped workspaces; never materialize the full active workspace set.
  const rows = collection(db, "click_rollups").aggregate<{
    _id: ObjectId;
    clicks: number;
    scans: number;
  }>([
    { $match: { day: start, workspaceId: { $type: "objectId" } } },
    {
      $group: {
        _id: "$workspaceId",
        clicks: { $sum: "$clicks" },
        scans: { $sum: "$scans" },
      },
    },
  ]);
  // Reset the day so deleted or reattributed source rows cannot leave stale totals.
  await collection(db, "workspace_daily").deleteMany({ day: start });
  for await (const row of rows) {
    await collection(db, "workspace_daily").updateOne(
      { workspaceId: row._id, day: start },
      {
        $set: { clicks: row.clicks, scans: row.scans, linksCreated: 0 },
        $setOnInsert: {
          _id: new ObjectId(
            createHash("sha256")
              .update(`${row._id}:${start.toISOString()}`)
              .digest("hex")
              .slice(0, 24),
          ),
        },
      },
      { upsert: true },
    );
  }
  for await (const row of collection(db, "links").aggregate<{
    _id: ObjectId;
    count: number;
  }>([
    { $match: { _id: ids, workspaceId: { $type: "objectId" } } },
    { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
  ])) {
    await collection(db, "workspace_daily").updateOne(
      { workspaceId: row._id, day: start },
      {
        $set: { linksCreated: row.count },
        $setOnInsert: {
          clicks: 0,
          scans: 0,
          _id: new ObjectId(
            createHash("sha256")
              .update(`${row._id}:${start.toISOString()}`)
              .digest("hex")
              .slice(0, 24),
          ),
        },
      },
      { upsert: true },
    );
  }
  // A historical refresh must preserve the billing snapshot captured on that day.
  await collection(db, "platform_daily").updateOne(
    { _id: daily._id },
    { $set: daily },
    { upsert: true },
  );
  return daily;
}

/** Today + yesterday stay fresh; each tick fills one missing day (at most 400). */
export function createPlatformMetrics(
  db: Db,
  now: () => Date = () => new Date(),
  bots?: Pick<Redis, "hvals">,
) {
  return async () => {
    const lease = crypto.randomUUID();
    const leases = db.collection<{
      _id: string;
      lease?: string;
      expiresAt: Date;
    }>(physicalNames.meta);
    try {
      await leases.updateOne(
        {
          _id: "platform-metrics",
          $or: [
            { expiresAt: { $lte: now() } },
            { expiresAt: { $exists: false } },
          ],
        },
        { $set: { lease, expiresAt: new Date(now().getTime() + 15 * 60000) } },
        { upsert: true },
      );
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      )
        return;
      throw error;
    }
    try {
      const today = utcDay(now());
      await computePlatformDay(db, today, now(), bots);
      await leases.updateOne(
        { _id: "platform-metrics", lease },
        { $set: { expiresAt: new Date(now().getTime() + 15 * 60000) } },
      );
      await computePlatformDay(
        db,
        new Date(today.getTime() - dayMs),
        now(),
        bots,
      );
      const existing = new Set(
        (
          await collection(db, "platform_daily")
            .find(
              {
                _id: {
                  $gte: new Date(today.getTime() - 399 * dayMs)
                    .toISOString()
                    .slice(0, 10),
                },
              },
              { projection: { _id: 1 } },
            )
            .limit(400)
            .toArray()
        ).map((d) => d._id),
      );
      for (let age = 2; age < 400; age++) {
        const day = new Date(today.getTime() - age * dayMs);
        if (!existing.has(day.toISOString().slice(0, 10))) {
          await computePlatformDay(db, day, now(), bots);
          break;
        }
      }
    } finally {
      await leases.updateOne(
        { _id: "platform-metrics", lease },
        { $set: { expiresAt: new Date(0) }, $unset: { lease: "" } },
      );
    }
  };
}
