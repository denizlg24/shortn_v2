import type { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import { names, oid, report, str, workspaceMaps } from "./helpers";
import type { Migration, MigrationContext } from "./runner";

const createdBy = "migration:0010-usage-periods";

export const periodOf = (date: Date) => date.toISOString().slice(0, 7);

function lastPeriods(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) =>
    periodOf(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1)),
    ),
  );
}

type Metric = "links" | "qrCodes" | "bioPages";

// Old months come from createdAt on the source documents (the source of
// truth); the legacy monthly counters only exist for the current month.
async function derivedCounts(ctx: MigrationContext, from: Date) {
  const sources: [string, string, string, Metric][] = [
    [names.links, "sub", "date", "links"],
    [names.qr_codes, "sub", "date", "qrCodes"],
    [names.bio_pages, "userId", "createdAt", "bioPages"],
  ];
  const counts = new Map<string, Record<Metric, number>>();
  for (const [collection, owner, dateField, metric] of sources) {
    if (!(await ctx.exists(collection))) continue;
    const rows = await ctx
      .read(collection)
      .aggregate<{ _id: { sub: string | null; period: string }; n: number }>([
        { $match: { [dateField]: { $gte: from } } },
        // Documents created through the legacy QR flow also create a link;
        // legacy counts those against qr_codes_this_month, not links.
        ...(collection === names.links
          ? [{ $match: { isQrCode: { $ne: true } } }]
          : []),
        {
          $group: {
            _id: {
              sub: `$${owner}`,
              period: {
                $dateToString: { date: `$${dateField}`, format: "%Y-%m" },
              },
            },
            n: { $sum: 1 },
          },
        },
      ])
      .toArray();
    for (const row of rows) {
      if (!row._id.sub) continue;
      const key = `${row._id.sub}:${row._id.period}`;
      const entry = counts.get(key) ?? { links: 0, qrCodes: 0, bioPages: 0 };
      entry[metric] += row.n;
      counts.set(key, entry);
    }
  }
  return counts;
}

function plan(ctx: MigrationContext, now: Date) {
  return async (users: Document[]) => {
    const periods = lastPeriods(now, 12);
    const current = periods[0] ?? periodOf(now);
    const oldest = periods.at(-1) ?? current;
    const counts = await derivedCounts(
      ctx,
      new Date(`${oldest}-01T00:00:00.000Z`),
    );
    const maps = await workspaceMaps(ctx);
    return users.flatMap((user): AnyBulkWriteOperation<Document>[] => {
      const workspaceId: ObjectId | undefined = maps.byUserId.get(
        String(user._id),
      );
      const sub = str(user.sub);
      if (!workspaceId || !sub) return [];
      return periods.map((period) => {
        const derived = counts.get(`${sub}:${period}`) ?? {
          links: 0,
          qrCodes: 0,
          bioPages: 0,
        };
        const legacy =
          period === current
            ? {
                links:
                  typeof user.links_this_month === "number"
                    ? user.links_this_month
                    : 0,
                qrCodes:
                  typeof user.qr_codes_this_month === "number"
                    ? user.qr_codes_this_month
                    : 0,
              }
            : undefined;
        return {
          updateOne: {
            filter: { workspaceId, period },
            update: {
              $set: {
                links: Math.max(derived.links, legacy?.links ?? 0),
                qrCodes: Math.max(derived.qrCodes, legacy?.qrCodes ?? 0),
                bioPages: derived.bioPages,
                derived,
                ...(legacy ? { legacyCounters: legacy } : {}),
                updatedAt: now,
              },
              $setOnInsert: { workspaceId, period, createdAt: now, createdBy },
            },
            upsert: true,
          },
        };
      });
    });
  };
}

export const usagePeriods: Migration = {
  id: "0010-usage-periods",
  phase: "backfill",
  async up(ctx) {
    await ctx.batch({
      name: names.user,
      target: names.usage_periods,
      checkpointId: "user__usage_periods",
      operations: plan(ctx, new Date()),
    });
  },
  async verify(ctx) {
    const exists = await ctx.exists(names.usage_periods);
    const rows = exists
      ? await ctx.read(names.usage_periods).find({ createdBy }).toArray()
      : [];
    if (ctx.direction === "down")
      return report(
        { rows: rows.length },
        rows.length ? [`${rows.length} usage periods remain`] : [],
      );
    const users = await ctx
      .read(names.user)
      .find({}, { projection: { _id: 1 } })
      .toArray();
    const maps = await workspaceMaps(ctx);
    const current = periodOf(new Date());
    const covered = new Set(
      rows
        .filter((row) => row.period === current)
        .map((row) => String(oid(row.workspaceId))),
    );
    const missing = users.filter((user) => {
      const workspaceId = maps.byUserId.get(String(user._id));
      return !workspaceId || !covered.has(workspaceId.toHexString());
    });
    const below = rows.filter(
      (row) =>
        row.legacyCounters &&
        (row.links < row.legacyCounters.links ||
          row.qrCodes < row.legacyCounters.qrCodes),
    );
    return report(
      {
        rows: rows.length,
        users: users.length,
        currentPeriodMissing: missing.length,
      },
      [
        ...missing.map(
          (user) => `user ${String(user._id)} has no ${current} usage period`,
        ),
        ...below.map((row) => `usage ${String(row._id)} below legacy counters`),
      ],
    );
  },
  async down(ctx) {
    if (await ctx.exists(names.usage_periods))
      await ctx.batch({
        name: names.usage_periods,
        filter: { createdBy },
        operations: (docs) =>
          docs.map((doc) => ({ deleteOne: { filter: { _id: doc._id } } })),
      });
  },
};
