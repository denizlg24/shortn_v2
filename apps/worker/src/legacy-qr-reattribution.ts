import { mongoLinkLoader, recomputeRollups } from "@shortn/core";
import { physicalNames as names } from "@shortn/db";
import { acquireMigrationLease } from "@shortn/db/migrations";
import type { MigrationLease } from "@shortn/db/migrations";
import { ObjectId } from "mongodb";
import type {
  AnyBulkWriteOperation,
  ClientSession,
  Db,
  Document,
  MongoClient,
} from "mongodb";

// One-off repair for legacy QR codes whose hidden backing link lacks
// `qrCodeId` (doc 19, "Known legacy data issue"). Every hit on such a link was
// a scan that legacy recorded as a click on the backing link.

export const operationId = "legacy-qr-reattribution";
export const runsCollection = "_legacy_qr_reattribution_runs";
export const archiveName = (collection: string) =>
  `archive_${collection}_${operationId}`;
const archived = {
  links: archiveName(names.links),
  qr_codes: archiveName(names.qr_codes),
  clicks: archiveName(names.clicks),
  click_events: archiveName(names.click_events),
  click_rollups: archiveName(names.click_rollups),
};

interface LinkDoc {
  _id: ObjectId;
  urlCode?: string;
  sub?: string;
  isQrCode?: boolean;
  qrCodeId?: string | null;
  workspaceId?: ObjectId;
  deletedAt?: Date;
  clicks?: { total?: number; lastClick?: Date | null };
  stats?: { legacyTotal?: number };
}
interface QrDoc {
  _id: ObjectId;
  qrCodeId?: string;
  urlId?: string;
  sub?: string;
  linkId?: ObjectId;
  workspaceId?: ObjectId;
  deletedAt?: Date;
  date?: Date;
  options?: { data?: unknown };
  design?: { data?: unknown };
  clicks?: { total?: number; lastClick?: Date | null };
  stats?: { legacyTotal?: number };
}
interface ClickRow {
  _id: ObjectId;
  urlCode?: string;
  type?: string | null;
  sub?: string;
}
interface EventMeta {
  linkId: ObjectId | null;
  kind: string;
  qrId?: ObjectId;
  reattributedBy?: string;
}
interface EventDoc {
  _id: ObjectId;
  ts: Date;
  m: EventMeta;
  legacyId?: ObjectId;
  sid?: string;
}
interface ArchiveEntry<T> {
  runId: string;
  sourceId: ObjectId;
  linkId: ObjectId;
  archivedAt: Date;
  reconstructed?: boolean;
  doc: T;
}

export type SkipReason =
  | "link-deleted"
  | "duplicate-link-code"
  | "no-qr"
  | "multiple-qrs"
  | "qr-deleted"
  | "qr-url-mismatch"
  | "qr-missing-code"
  | "duplicate-qr-code"
  | "qr-linked-elsewhere"
  | "owner-mismatch"
  | "workspace-mismatch"
  | "foreign-rows"
  | "bio-attributed"
  | "inconsistent-events"
  | "sweep-mismatch";

export type EncodedPath = "qr-path" | "root-path" | "other" | "none";

export interface LinkCounts {
  clickRows: number;
  scanRows: number;
  rowsWithReferrer: number;
  clickEvents: number;
  scanEvents: number;
  legacyClickEvents: number;
  liveClickEvents: number;
  rollups: number;
  linkTotal: number;
  qrTotal: number;
  linkLegacyTotal: number | null;
  qrLegacyTotal: number | null;
  firstClickRow: Date | null;
}

export interface PlannedLink {
  linkId: ObjectId;
  urlCode: string;
  qrId: ObjectId;
  qrCodeId: string;
  sweep: boolean;
  qrCreated: Date | null;
  encodedPath: EncodedPath;
  before: LinkCounts;
}

export interface SkippedLink {
  linkId: ObjectId;
  urlCode: string;
  reason: SkipReason;
  detail: string;
  qrIds: ObjectId[];
  clickRows: number;
}

export interface Plan {
  startId: ObjectId;
  totals: { qrCodes: number; backingLinks: number; withoutQrCodeId: number };
  links: PlannedLink[];
  skipped: SkippedLink[];
  orphanEvents: number;
}

interface Transfer {
  // Taken off the backing link.
  clicks: number;
  legacyTotal: number;
  // Added to the QR: the QR's counters already hold a snapshot of the link's
  // (equal for most codes), so only the link's growth since then moves over.
  qrClicks: number;
  qrLegacyTotal: number;
  at: Date;
  linkLastClick?: Date;
  qrLastClickBefore?: Date | null;
  qrLastClickMissing?: boolean;
  qrLastClickAfter?: Date;
  qrTotalMissing?: boolean;
}

export interface RunLink extends PlannedLink {
  backfilled?: boolean;
  conflict?: string;
  rowsConverted?: number;
  eventsConverted?: number;
  transfer?: Transfer;
  restored?: boolean;
}

export type RunStatus =
  "applying" | "applied" | "failed" | "rolling-back" | "rolled-back";

export interface VerifyResult {
  ok: boolean;
  quiescent: boolean;
  counts: Record<string, number>;
  discrepancies: string[];
}

export interface RunDoc {
  _id: string;
  status: RunStatus;
  startedAt: Date;
  startId: ObjectId;
  links: RunLink[];
  skipped: SkippedLink[];
  finishedAt?: Date;
  verify?: VerifyResult;
  rollbackVerify?: VerifyResult;
  rolledBackAt?: Date;
  error?: string;
}

export type Phase =
  | "archived"
  | "backfilled"
  | "settled"
  | "rows"
  | "events"
  | "converted"
  | "rolled-back-links";

export interface ReattributionOptions {
  client: MongoClient;
  db: Db;
  linkDomain?: string;
  batchSize?: number;
  settleMs?: number;
  leaseMs?: number;
  invalidate?: (keys: string[]) => Promise<void>;
  log?: (message: string) => void;
  onPhase?: (phase: Phase, runId: string) => Promise<void>;
}

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const hex = (id: ObjectId) => id.toHexString();
const clickRowFilter = (urlCode: string) => ({
  urlCode,
  type: { $ne: "scan" },
});
// Only meta-field predicates: time-series updates accept nothing else
// (MongoDB 8.2 keeps arbitrary time-series updates behind a disabled flag).
const convertibleEvents = (linkId: ObjectId) => ({
  "m.linkId": linkId,
  "m.kind": "click",
  "m.qrId": { $exists: false },
  "m.reattributedBy": { $exists: false },
  "m.bioPageId": { $exists: false },
});

export function newRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return `lqr-${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}
export const isRunId = (value: string) =>
  /^lqr-\d{8}T\d{6}Z-[0-9a-f]{4}$/.test(value);

function encodedPath(qr: QrDoc, urlCode: string): EncodedPath {
  const data = qr.options?.data ?? qr.design?.data;
  if (typeof data !== "string" || !data) return "none";
  try {
    const path = new URL(data).pathname.replace(/\/$/, "");
    if (path === `/qr/${urlCode}`) return "qr-path";
    if (path === `/${urlCode}`) return "root-path";
  } catch {
    /* Not a URL; reported as "other". */
  }
  return "other";
}

async function groupCounts(
  db: Db,
  collection: string,
  pipeline: Document[],
): Promise<Document[]> {
  return db.collection(collection).aggregate(pipeline).toArray();
}

const typeIs = (path: string, type: string) => ({
  $eq: [{ $type: path }, type],
});

export async function buildPlan(db: Db): Promise<Plan> {
  // Taken before any count, so documents created later are "arrivals".
  const startId = new ObjectId();
  const links = db.collection<LinkDoc>(names.links);
  const qrs = db.collection<QrDoc>(names.qr_codes);
  const runs = db.collection<RunDoc>(runsCollection);

  const sweeps = new Map<string, { qrId: ObjectId; qrCodeId: string }>();
  for (const run of await runs
    .find(
      { status: { $in: ["applied", "failed"] } },
      { sort: { startedAt: 1 } },
    )
    .toArray())
    for (const link of run.links)
      if (!link.conflict)
        sweeps.set(hex(link.linkId), {
          qrId: link.qrId,
          qrCodeId: link.qrCodeId,
        });

  const candidates = await links
    .find(
      {
        $or: [
          { isQrCode: true, qrCodeId: { $in: [null, ""] } },
          { _id: { $in: [...sweeps.keys()].map((id) => new ObjectId(id)) } },
        ],
      },
      {
        projection: {
          urlCode: 1,
          sub: 1,
          isQrCode: 1,
          qrCodeId: 1,
          workspaceId: 1,
          deletedAt: 1,
          clicks: 1,
          "stats.legacyTotal": 1,
        },
        sort: { _id: 1 },
      },
    )
    .toArray();
  const [qrCodes, backingLinks, withoutQrCodeId] = await Promise.all([
    qrs.countDocuments(),
    links.countDocuments({ isQrCode: true }),
    links.countDocuments({ isQrCode: true, qrCodeId: { $in: [null, ""] } }),
  ]);
  const totals = { qrCodes, backingLinks, withoutQrCodeId };
  const urlCodes = candidates.flatMap((link) =>
    typeof link.urlCode === "string" && link.urlCode ? [link.urlCode] : [],
  );
  const linkIds = candidates.map((link) => link._id);
  if (!candidates.length)
    return { startId, totals, links: [], skipped: [], orphanEvents: 0 };

  const matchingQrs = await qrs
    .find(
      { $or: [{ urlId: { $in: urlCodes } }, { linkId: { $in: linkIds } }] },
      {
        projection: {
          qrCodeId: 1,
          urlId: 1,
          sub: 1,
          linkId: 1,
          workspaceId: 1,
          deletedAt: 1,
          date: 1,
          "options.data": 1,
          "design.data": 1,
          clicks: 1,
          "stats.legacyTotal": 1,
        },
      },
    )
    .toArray();
  const qrCodeIds = matchingQrs.flatMap((qr) =>
    typeof qr.qrCodeId === "string" && qr.qrCodeId ? [qr.qrCodeId] : [],
  );
  const duplicated = async (
    collection: string,
    field: string,
    values: string[],
  ) =>
    new Set(
      (
        await groupCounts(db, collection, [
          { $match: { [field]: { $in: values } } },
          { $group: { _id: `$${field}`, n: { $sum: 1 } } },
          { $match: { n: { $gt: 1 } } },
        ])
      ).map((row) => String(row._id)),
    );
  const [duplicateLinkCodes, duplicateQrCodes, rowStats, scanRows, events] =
    await Promise.all([
      duplicated(names.links, "urlCode", urlCodes),
      duplicated(names.qr_codes, "qrCodeId", qrCodeIds),
      groupCounts(db, names.clicks, [
        { $match: { urlCode: { $in: urlCodes }, type: { $ne: "scan" } } },
        {
          $group: {
            _id: "$urlCode",
            n: { $sum: 1 },
            subs: { $addToSet: "$sub" },
            referrer: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      typeIs("$referrer", "string"),
                      { $ne: ["$referrer", ""] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            bio: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      typeIs("$queryParams.ref", "string"),
                      {
                        $regexMatch: {
                          input: "$queryParams.ref",
                          regex: /^bio:/i,
                        },
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            first: { $min: "$timestamp" },
          },
        },
      ]),
      groupCounts(db, names.clicks, [
        { $match: { urlCode: { $in: qrCodeIds }, type: "scan" } },
        { $group: { _id: "$urlCode", n: { $sum: 1 } } },
      ]),
      groupCounts(db, names.click_events, [
        { $match: { "m.linkId": { $in: linkIds } } },
        {
          $group: {
            _id: { link: "$m.linkId", kind: "$m.kind" },
            n: { $sum: 1 },
            legacy: {
              $sum: { $cond: [typeIs("$legacyId", "objectId"), 1, 0] },
            },
            live: { $sum: { $cond: [typeIs("$sid", "string"), 1, 0] } },
            bio: {
              $sum: { $cond: [typeIs("$m.bioPageId", "objectId"), 1, 0] },
            },
            odd: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      typeIs("$m.qrId", "objectId"),
                      typeIs("$m.reattributedBy", "string"),
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);
  const [rollups, orphanEvents] = await Promise.all([
    groupCounts(db, names.click_rollups, [
      { $match: { linkId: { $in: linkIds } } },
      { $group: { _id: "$linkId", n: { $sum: 1 } } },
    ]),
    db
      .collection(names.click_events)
      .countDocuments({ "m.linkId": null, "m.legacyCode": { $in: urlCodes } }),
  ]);
  const rowsByCode = new Map(rowStats.map((row) => [String(row._id), row]));
  const scanRowsByCode = new Map(
    scanRows.map((row) => [String(row._id), count(row.n)]),
  );
  const rollupsByLink = new Map(
    rollups.map((row) => [String(row._id), count(row.n)]),
  );
  const eventStats = (linkId: ObjectId, kind: string) =>
    events.find(
      (row) => String(row._id.link) === hex(linkId) && row._id.kind === kind,
    );

  const planned: PlannedLink[] = [];
  const skipped: SkippedLink[] = [];
  for (const link of candidates) {
    const urlCode = link.urlCode ?? "";
    const sweep = sweeps.get(hex(link._id));
    const unfixed = !link.qrCodeId;
    const matches = matchingQrs.filter(
      (qr) => (urlCode && qr.urlId === urlCode) || qr.linkId?.equals(link._id),
    );
    const rows = rowsByCode.get(urlCode);
    const clickEvents = eventStats(link._id, "click");
    const clickRows = count(rows?.n);
    const skip = (reason: SkipReason, detail: string) =>
      skipped.push({
        linkId: link._id,
        urlCode,
        reason,
        detail,
        qrIds: matches.map((qr) => qr._id),
        clickRows,
      });
    const qr = matches[0];
    const subs: unknown[] = Array.isArray(rows?.subs) ? rows.subs : [];
    if (link.deletedAt) skip("link-deleted", "backing link is in the trash");
    else if (!urlCode || duplicateLinkCodes.has(urlCode))
      skip("duplicate-link-code", "urlCode is missing or not unique");
    else if (!qr) skip("no-qr", "no QR code has this urlId or linkId");
    else if (matches.length > 1)
      skip("multiple-qrs", `${matches.length} QR codes map to this link`);
    else if (qr.deletedAt) skip("qr-deleted", "QR code is in the trash");
    else if (qr.urlId !== urlCode)
      skip("qr-url-mismatch", `QR urlId is ${String(qr.urlId)}`);
    else if (!qr.qrCodeId) skip("qr-missing-code", "QR has no qrCodeId");
    else if (duplicateQrCodes.has(qr.qrCodeId))
      skip("duplicate-qr-code", `qrCodeId ${qr.qrCodeId} is not unique`);
    // The redirect loader matches the QR by linkId, or by urlId+qrCodeId only
    // when linkId is absent; anything else would leave the link untracked.
    else if (
      "linkId" in qr &&
      !(qr.linkId instanceof ObjectId && qr.linkId.equals(link._id))
    )
      skip("qr-linked-elsewhere", `QR linkId is ${String(qr.linkId)}`);
    else if ((qr.sub ?? null) !== (link.sub ?? null))
      skip("owner-mismatch", `QR sub ${qr.sub} vs link sub ${link.sub}`);
    else if (
      link.workspaceId &&
      qr.workspaceId &&
      !link.workspaceId.equals(qr.workspaceId)
    )
      skip("workspace-mismatch", "QR and link are in different workspaces");
    else if (subs.some((sub) => sub !== (link.sub ?? null)))
      skip("foreign-rows", "click rows carry another owner's sub");
    else if (count(rows?.bio) || count(clickEvents?.bio))
      skip("bio-attributed", "some clicks came through a bio page");
    else if (count(clickEvents?.odd))
      skip("inconsistent-events", "click events already carry QR fields");
    else if (
      sweep &&
      !unfixed &&
      (link.qrCodeId !== sweep.qrCodeId || !qr._id.equals(sweep.qrId))
    )
      skip("sweep-mismatch", "mapping changed since the earlier run");
    else {
      const before: LinkCounts = {
        clickRows,
        scanRows: scanRowsByCode.get(qr.qrCodeId) ?? 0,
        rowsWithReferrer: count(rows?.referrer),
        clickEvents: count(clickEvents?.n),
        scanEvents: count(eventStats(link._id, "scan")?.n),
        legacyClickEvents: count(clickEvents?.legacy),
        liveClickEvents: count(clickEvents?.live),
        rollups: rollupsByLink.get(hex(link._id)) ?? 0,
        linkTotal: count(link.clicks?.total),
        qrTotal: count(qr.clicks?.total),
        linkLegacyTotal: isCount(link.stats?.legacyTotal)
          ? link.stats.legacyTotal
          : null,
        qrLegacyTotal: isCount(qr.stats?.legacyTotal)
          ? qr.stats.legacyTotal
          : null,
        firstClickRow: rows?.first instanceof Date ? rows.first : null,
      };
      const pending =
        unfixed || before.clickRows || before.clickEvents || before.linkTotal;
      if (pending)
        planned.push({
          linkId: link._id,
          urlCode,
          qrId: qr._id,
          qrCodeId: qr.qrCodeId,
          sweep: Boolean(sweep) && !unfixed,
          qrCreated: qr.date instanceof Date ? qr.date : null,
          encodedPath: encodedPath(qr, urlCode),
          before,
        });
    }
  }
  return { startId, totals, links: planned, skipped, orphanEvents };
}

export function predictedAfter(link: PlannedLink) {
  const { before } = link;
  const moveLegacy =
    before.linkLegacyTotal !== null && before.qrLegacyTotal !== null;
  return {
    clickRows: 0,
    scanRows: before.scanRows + before.clickRows,
    clickEvents: 0,
    scanEvents: before.scanEvents + before.clickEvents,
    linkTotal: 0,
    qrTotal: Math.max(before.qrTotal, before.linkTotal),
    linkLegacyTotal: moveLegacy ? 0 : before.linkLegacyTotal,
    qrLegacyTotal: moveLegacy
      ? Math.max(before.qrLegacyTotal ?? 0, before.linkLegacyTotal ?? 0)
      : before.qrLegacyTotal,
  };
}

async function inTransaction<T>(
  client: MongoClient,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = client.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
}

async function ensureArchives(db: Db) {
  for (const name of Object.values(archived)) {
    await db
      .collection(name)
      .createIndex(
        { runId: 1, sourceId: 1 },
        { unique: true, name: "run_source" },
      );
    await db
      .collection(name)
      .createIndex({ runId: 1, linkId: 1 }, { name: "run_link" });
  }
}

// $setOnInsert keeps the first copy, so a resumed run never overwrites an
// original with an already-modified document.
async function archiveDocs(
  db: Db,
  name: string,
  runId: string,
  linkId: ObjectId,
  docs: (Document & { _id: ObjectId })[],
  reconstructed = false,
) {
  if (!docs.length) return;
  const archivedAt = new Date();
  await db.collection(name).bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { runId, sourceId: doc._id },
        update: {
          $setOnInsert: {
            runId,
            sourceId: doc._id,
            linkId,
            archivedAt,
            ...(reconstructed ? { reconstructed: true } : {}),
            doc,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

interface Context {
  client: MongoClient;
  db: Db;
  lease: MigrationLease;
  batchSize: number;
  log: (message: string) => void;
  onPhase: (phase: Phase, runId: string) => Promise<void>;
}

async function setLink(
  ctx: Context,
  runId: string,
  linkId: ObjectId,
  fields: Partial<RunLink>,
  session?: ClientSession,
) {
  await ctx.db.collection<RunDoc>(runsCollection).updateOne(
    { _id: runId },
    {
      $set: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
          `links.$[l].${key}`,
          value,
        ]),
      ),
    },
    { arrayFilters: [{ "l.linkId": linkId }], ...(session ? { session } : {}) },
  );
}

async function backfill(ctx: Context, run: RunDoc, link: RunLink) {
  if (link.backfilled || link.conflict) return;
  await ctx.lease.assert();
  const links = ctx.db.collection<LinkDoc>(names.links);
  const result = await links.updateOne(
    { _id: link.linkId, isQrCode: true, qrCodeId: { $in: [null, ""] } },
    { $set: { qrCodeId: link.qrCodeId } },
  );
  const current = result.modifiedCount
    ? undefined
    : await links.findOne(
        { _id: link.linkId },
        { projection: { qrCodeId: 1 } },
      );
  if (result.modifiedCount || current?.qrCodeId === link.qrCodeId) {
    link.backfilled = true;
    await setLink(ctx, run._id, link.linkId, { backfilled: true });
  } else {
    link.conflict = `qrCodeId changed to ${String(current?.qrCodeId)} during the run`;
    await setLink(ctx, run._id, link.linkId, { conflict: link.conflict });
  }
}

async function convertRows(ctx: Context, run: RunDoc, link: RunLink) {
  const clicks = ctx.db.collection<ClickRow>(names.clicks);
  let converted = 0;
  while (true) {
    await ctx.lease.assert();
    const rows = await clicks
      .find(clickRowFilter(link.urlCode), {
        sort: { _id: 1 },
        limit: ctx.batchSize,
      })
      .toArray();
    if (!rows.length) break;
    await archiveDocs(ctx.db, archived.clicks, run._id, link.linkId, rows);
    const result = await clicks.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id, ...clickRowFilter(link.urlCode) },
          update: { $set: { type: "scan", urlCode: link.qrCodeId } },
        },
      })),
      { ordered: false },
    );
    if (!result.modifiedCount)
      throw new Error(
        `Click rows of ${link.urlCode} changed concurrently; re-run --apply to resume`,
      );
    converted += result.modifiedCount;
  }
  return converted;
}

async function convertEvents(ctx: Context, run: RunDoc, link: RunLink) {
  const events = ctx.db.collection<EventDoc>(names.click_events);
  const archive = ctx.db.collection<ArchiveEntry<EventDoc>>(
    archived.click_events,
  );
  await ctx.lease.assert();
  let chunk: EventDoc[] = [];
  for await (const event of events.find(convertibleEvents(link.linkId), {
    batchSize: ctx.batchSize,
  })) {
    chunk.push(event);
    if (chunk.length >= ctx.batchSize) {
      await archiveDocs(
        ctx.db,
        archive.collectionName,
        run._id,
        link.linkId,
        chunk,
      );
      chunk = [];
    }
  }
  await archiveDocs(
    ctx.db,
    archive.collectionName,
    run._id,
    link.linkId,
    chunk,
  );
  await ctx.onPhase("events", run._id);
  await ctx.lease.assert();
  const result = await events.updateMany(convertibleEvents(link.linkId), {
    $set: {
      "m.kind": "scan",
      "m.qrId": link.qrId,
      "m.reattributedBy": run._id,
    },
  });
  // The meta-only update also converts events that arrived after the copy
  // above; their original is the exact inverse of the update.
  const marked = { "m.linkId": link.linkId, "m.reattributedBy": run._id };
  const [markedCount, archivedCount] = await Promise.all([
    events.countDocuments(marked),
    archive.countDocuments({ runId: run._id, linkId: link.linkId }),
  ]);
  if (markedCount !== archivedCount) {
    const known = new Set(
      (
        await archive
          .find(
            { runId: run._id, linkId: link.linkId },
            { projection: { sourceId: 1 } },
          )
          .toArray()
      ).map((entry) => hex(entry.sourceId)),
    );
    const late: EventDoc[] = [];
    for await (const event of events.find(marked))
      if (!known.has(hex(event._id))) {
        const m: EventMeta = { ...event.m, kind: "click" };
        delete m.qrId;
        delete m.reattributedBy;
        late.push({ ...event, m });
      }
    await archiveDocs(
      ctx.db,
      archive.collectionName,
      run._id,
      link.linkId,
      late,
      true,
    );
  }
  return result.modifiedCount;
}

// The transfer and its journal entry commit together; a concurrent worker
// $inc on either document makes the transaction retry, so no hit is lost.
async function transferCounters(ctx: Context, run: RunDoc, link: RunLink) {
  if (link.transfer) return;
  await ctx.lease.assert();
  const links = ctx.db.collection<LinkDoc>(names.links);
  const qrs = ctx.db.collection<QrDoc>(names.qr_codes);
  const runs = ctx.db.collection<RunDoc>(runsCollection);
  const transfer = await inTransaction(ctx.client, async (session) => {
    const pending = await runs.findOne(
      {
        _id: run._id,
        links: {
          $elemMatch: { linkId: link.linkId, transfer: { $exists: false } },
        },
      },
      { session, projection: { _id: 1 } },
    );
    if (!pending) return undefined;
    const linkDoc = await links.findOne(
      { _id: link.linkId },
      { session, projection: { clicks: 1, "stats.legacyTotal": 1 } },
    );
    const qrDoc = await qrs.findOne(
      { _id: link.qrId },
      { session, projection: { clicks: 1, "stats.legacyTotal": 1 } },
    );
    if (!linkDoc || !qrDoc)
      throw new Error(`Link or QR of ${link.urlCode} disappeared mid-run`);
    const clicks = count(linkDoc.clicks?.total);
    const lastClick =
      linkDoc.clicks?.lastClick instanceof Date
        ? linkDoc.clicks.lastClick
        : undefined;
    const linkLegacy = linkDoc.stats?.legacyTotal;
    const legacyTotal =
      isCount(linkLegacy) && isCount(qrDoc.stats?.legacyTotal) ? linkLegacy : 0;
    const qrLast = qrDoc.clicks?.lastClick;
    const raisesQrLast =
      lastClick !== undefined &&
      !(qrLast instanceof Date && qrLast >= lastClick);
    const qrClicks = Math.max(0, clicks - link.before.qrTotal);
    const qrLegacyTotal = legacyTotal
      ? Math.max(0, legacyTotal - (link.before.qrLegacyTotal ?? 0))
      : 0;
    const result: Transfer = {
      clicks,
      legacyTotal,
      qrClicks,
      qrLegacyTotal,
      at: new Date(),
      ...(lastClick ? { linkLastClick: lastClick } : {}),
      ...(raisesQrLast && lastClick
        ? {
            qrLastClickAfter: lastClick,
            ...(qrLast === undefined
              ? { qrLastClickMissing: true }
              : { qrLastClickBefore: qrLast }),
          }
        : {}),
      ...(qrClicks && qrDoc.clicks?.total === undefined
        ? { qrTotalMissing: true }
        : {}),
    };
    const linkSet: Document = {
      ...(lastClick ? { "clicks.lastClick": null } : {}),
      ...(legacyTotal ? { "stats.legacyTotal": 0 } : {}),
    };
    if (clicks || Object.keys(linkSet).length)
      await links.updateOne(
        { _id: link.linkId },
        {
          ...(clicks ? { $inc: { "clicks.total": -clicks } } : {}),
          ...(Object.keys(linkSet).length ? { $set: linkSet } : {}),
        },
        { session },
      );
    const qrInc: Document = {
      ...(qrClicks ? { "clicks.total": qrClicks } : {}),
      ...(qrLegacyTotal ? { "stats.legacyTotal": qrLegacyTotal } : {}),
    };
    if (Object.keys(qrInc).length || raisesQrLast)
      await qrs.updateOne(
        { _id: link.qrId },
        {
          ...(Object.keys(qrInc).length ? { $inc: qrInc } : {}),
          ...(raisesQrLast && lastClick
            ? { $max: { "clicks.lastClick": lastClick } }
            : {}),
        },
        { session },
      );
    await setLink(ctx, run._id, link.linkId, { transfer: result }, session);
    return result;
  });
  if (transfer) link.transfer = transfer;
}

async function refreshRollups(ctx: Context, run: RunDoc, linkIds: ObjectId[]) {
  if (!linkIds.length) return;
  const rollups = await ctx.db
    .collection(names.click_rollups)
    .find({ linkId: { $in: linkIds } })
    .toArray();
  for (const linkId of linkIds)
    await archiveDocs(
      ctx.db,
      archived.click_rollups,
      run._id,
      linkId,
      rollups.flatMap((rollup) =>
        rollup.linkId instanceof ObjectId &&
        rollup.linkId.equals(linkId) &&
        rollup._id instanceof ObjectId
          ? [{ ...rollup, _id: rollup._id }]
          : [],
      ),
    );
  const [first] = await ctx.db
    .collection<EventDoc>(names.click_events)
    .find({ "m.linkId": { $in: linkIds } }, { projection: { ts: 1 } })
    .sort({ ts: 1 })
    .limit(1)
    .toArray();
  if (first) await recomputeRollups(ctx.db, first.ts, new Date(), linkIds);
}

async function archiveOriginals(ctx: Context, run: RunDoc, links: RunLink[]) {
  for (let i = 0; i < links.length; i += ctx.batchSize) {
    const chunk = links.slice(i, i + ctx.batchSize);
    await ctx.lease.assert();
    const [linkDocs, qrDocs] = await Promise.all([
      ctx.db
        .collection<LinkDoc>(names.links)
        .find({ _id: { $in: chunk.map((link) => link.linkId) } })
        .toArray(),
      ctx.db
        .collection<QrDoc>(names.qr_codes)
        .find({ _id: { $in: chunk.map((link) => link.qrId) } })
        .toArray(),
    ]);
    for (const link of chunk) {
      await archiveDocs(
        ctx.db,
        archived.links,
        run._id,
        link.linkId,
        linkDocs.filter((doc) => doc._id.equals(link.linkId)),
      );
      await archiveDocs(
        ctx.db,
        archived.qr_codes,
        run._id,
        link.linkId,
        qrDocs.filter((doc) => doc._id.equals(link.qrId)),
      );
    }
  }
}

function context(
  options: ReattributionOptions,
  lease: MigrationLease,
): Context {
  const batchSize = options.batchSize ?? 1000;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000)
    throw new Error("batchSize must be 1–5000");
  return {
    client: options.client,
    db: options.db,
    lease,
    batchSize,
    log: options.log ?? console.log,
    onPhase: options.onPhase ?? (async () => {}),
  };
}

export interface ApplyResult {
  plan: Plan | null;
  run: RunDoc | null;
  verify: VerifyResult | null;
}

export async function applyReattribution(
  options: ReattributionOptions,
): Promise<ApplyResult> {
  const lease = await acquireMigrationLease(
    options.client,
    options.db,
    options.leaseMs,
  );
  const ctx = context(options, lease);
  const runs = ctx.db.collection<RunDoc>(runsCollection);
  let runId: string | undefined;
  try {
    const rollingBack = await runs.findOne({ status: "rolling-back" });
    if (rollingBack)
      throw new Error(
        `Run ${rollingBack._id} stopped mid-rollback; finish it with --rollback ${rollingBack._id}`,
      );
    let plan: Plan | null = null;
    let run = await runs.findOne(
      { status: "applying" },
      { sort: { startedAt: -1 } },
    );
    if (run) ctx.log(`resuming run ${run._id}`);
    else {
      plan = await buildPlan(ctx.db);
      if (!plan.links.length) {
        ctx.log("nothing to reattribute");
        return { plan, run: null, verify: null };
      }
      run = {
        _id: newRunId(),
        status: "applying",
        startedAt: new Date(),
        startId: plan.startId,
        links: plan.links,
        skipped: plan.skipped,
      };
      await runs.insertOne(run);
      ctx.log(`run ${run._id}: ${run.links.length} links`);
    }
    runId = run._id;
    await ensureArchives(ctx.db);
    await archiveOriginals(ctx, run, run.links);
    await ctx.onPhase("archived", run._id);

    for (const link of run.links) await backfill(ctx, run, link);
    const active = run.links.filter((link) => !link.conflict);
    if (options.invalidate)
      await options.invalidate(active.map((link) => link.urlCode));
    await ctx.onPhase("backfilled", run._id);
    // Redirect processes keep resolved links in memory for ~10 s and queued
    // clicks drain within seconds; later stragglers are swept by a re-run.
    if (options.settleMs) await Bun.sleep(options.settleMs);
    await ctx.onPhase("settled", run._id);

    for (const link of active) {
      const rows = await convertRows(ctx, run, link);
      await ctx.onPhase("rows", run._id);
      const events = await convertEvents(ctx, run, link);
      await transferCounters(ctx, run, link);
      link.rowsConverted = (link.rowsConverted ?? 0) + rows;
      link.eventsConverted = (link.eventsConverted ?? 0) + events;
      await setLink(ctx, run._id, link.linkId, {
        rowsConverted: link.rowsConverted,
        eventsConverted: link.eventsConverted,
      });
    }
    await ctx.onPhase("converted", run._id);
    await ctx.lease.assert();
    await refreshRollups(
      ctx,
      run,
      active.map((link) => link.linkId),
    );

    const stored = await runs.findOne({ _id: run._id });
    if (!stored) throw new Error(`Run ${run._id} disappeared`);
    const verify = await verifyApplied(ctx.db, stored, options.linkDomain);
    await runs.updateOne(
      { _id: run._id },
      {
        $set: {
          status: verify.ok ? "applied" : "failed",
          finishedAt: new Date(),
          verify,
        },
      },
    );
    return { plan, run: { ...stored, verify }, verify };
  } catch (error) {
    // A failed attempt stays "applying" so the next --apply resumes it.
    if (runId)
      await runs
        .updateOne(
          { _id: runId },
          {
            $set: {
              error: error instanceof Error ? error.message : String(error),
            },
          },
        )
        .catch(() => undefined);
    throw error;
  } finally {
    await lease.release().catch(() => undefined);
  }
}

async function archivedOriginals(db: Db, runId: string, link: RunLink) {
  const [linkEntry, qrEntry] = await Promise.all([
    db
      .collection<ArchiveEntry<LinkDoc>>(archived.links)
      .findOne({ runId, sourceId: link.linkId }),
    db
      .collection<ArchiveEntry<QrDoc>>(archived.qr_codes)
      .findOne({ runId, sourceId: link.qrId }),
  ]);
  return { oldLink: linkEntry?.doc, oldQr: qrEntry?.doc };
}

const archivedRows = (db: Db, runId: string, linkId: ObjectId) =>
  db
    .collection<ArchiveEntry<ClickRow>>(archived.clicks)
    .find({ runId, linkId })
    .toArray();

const archivedEventIds = async (db: Db, runId: string, linkId: ObjectId) =>
  (
    await db
      .collection<ArchiveEntry<EventDoc>>(archived.click_events)
      .find({ runId, linkId }, { projection: { sourceId: 1 } })
      .toArray()
  ).map((entry) => entry.sourceId);

async function duplicates(db: Db, linkId: ObjectId, field: string) {
  return groupCounts(db, names.click_events, [
    { $match: { "m.linkId": linkId, [field]: { $exists: true } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
    { $count: "n" },
  ]).then((rows) => count(rows[0]?.n));
}

interface Snapshot {
  rows: number;
  clickRows: number;
  events: number;
  clickEvents: number;
  rowArrivals: number;
  eventArrivals: number;
  duplicates: number;
}

async function snapshot(db: Db, run: RunDoc, link: RunLink): Promise<Snapshot> {
  const clicks = db.collection<ClickRow>(names.clicks);
  const events = db.collection<EventDoc>(names.click_events);
  const codes = {
    $or: [
      { urlCode: link.urlCode, type: { $ne: "scan" } },
      { urlCode: link.qrCodeId, type: "scan" },
    ],
  };
  const [
    rows,
    clickRows,
    clickEvents,
    scanEvents,
    rowArrivals,
    eventArrivals,
    byLegacyId,
    bySid,
    byId,
  ] = await Promise.all([
    clicks.countDocuments(codes),
    clicks.countDocuments(clickRowFilter(link.urlCode)),
    events.countDocuments({ "m.linkId": link.linkId, "m.kind": "click" }),
    events.countDocuments({ "m.linkId": link.linkId, "m.kind": "scan" }),
    clicks.countDocuments({ ...codes, _id: { $gte: run.startId } }),
    events.countDocuments({
      "m.linkId": link.linkId,
      _id: { $gte: run.startId },
    }),
    duplicates(db, link.linkId, "legacyId"),
    duplicates(db, link.linkId, "sid"),
    duplicates(db, link.linkId, "_id"),
  ]);
  return {
    rows,
    clickRows,
    events: clickEvents + scanEvents,
    clickEvents,
    rowArrivals,
    eventArrivals,
    duplicates: byLegacyId + bySid + byId,
  };
}

async function derivedCounters(db: Db, link: RunLink, issues: string[]) {
  const [stored, rollups] = await Promise.all([
    db
      .collection<{
        _id: ObjectId;
        stats?: { clicks?: number; scans?: number };
      }>(names.links)
      .findOne({ _id: link.linkId }, { projection: { stats: 1 } }),
    groupCounts(db, names.click_rollups, [
      { $match: { linkId: link.linkId } },
      {
        $group: {
          _id: null,
          clicks: { $sum: "$clicks" },
          scans: { $sum: "$scans" },
        },
      },
    ]),
  ]);
  const events = db.collection<EventDoc>(names.click_events);
  const [clicks, scans] = await Promise.all([
    events.countDocuments({ "m.linkId": link.linkId, "m.kind": "click" }),
    events.countDocuments({ "m.linkId": link.linkId, "m.kind": "scan" }),
  ]);
  if (!clicks && !scans) return;
  const rollup = rollups[0];
  if (count(rollup?.clicks) !== clicks || count(rollup?.scans) !== scans)
    issues.push(
      `${link.urlCode}: rollups ${count(rollup?.clicks)}/${count(rollup?.scans)} ≠ events ${clicks}/${scans} (clicks/scans)`,
    );
  if (
    count(stored?.stats?.clicks) !== clicks ||
    count(stored?.stats?.scans) !== scans
  )
    issues.push(
      `${link.urlCode}: links.stats ${count(stored?.stats?.clicks)}/${count(stored?.stats?.scans)} ≠ events ${clicks}/${scans}`,
    );
}

export async function verifyApplied(
  db: Db,
  run: RunDoc,
  linkDomain = "shortn.at",
): Promise<VerifyResult> {
  const issues: string[] = [];
  const counts = {
    links: 0,
    rowsConverted: 0,
    eventsConverted: 0,
    clicksTransferred: 0,
    rowArrivals: 0,
    eventArrivals: 0,
    remainingClickRows: 0,
    remainingClickEvents: 0,
    duplicateEvents: 0,
  };
  const load = mongoLinkLoader(db, linkDomain);
  const links = db.collection<LinkDoc>(names.links);
  const qrs = db.collection<QrDoc>(names.qr_codes);
  const clicks = db.collection<ClickRow>(names.clicks);
  const events = db.collection<EventDoc>(names.click_events);
  let quiescent = true;
  for (const link of run.links) {
    if (link.conflict) {
      issues.push(`${link.urlCode}: skipped mid-run (${link.conflict})`);
      continue;
    }
    counts.links++;
    const [linkDoc, qrDoc, legacyQrs, cached, now] = await Promise.all([
      links.findOne({ _id: link.linkId }),
      qrs.findOne({ _id: link.qrId }),
      qrs
        .find({ urlId: link.urlCode }, { projection: { qrCodeId: 1 } })
        .toArray(),
      load(linkDomain, link.urlCode),
      snapshot(db, run, link),
    ]);
    const arrivals = now.rowArrivals + now.eventArrivals;
    if (arrivals) quiescent = false;
    counts.rowArrivals += now.rowArrivals;
    counts.eventArrivals += now.eventArrivals;
    if (!linkDoc?.isQrCode || linkDoc.qrCodeId !== link.qrCodeId)
      issues.push(`${link.urlCode}: backing link qrCodeId not backfilled`);
    if (legacyQrs.length !== 1 || legacyQrs[0]?.qrCodeId !== link.qrCodeId)
      issues.push(`${link.urlCode}: legacy urlId lookup does not find the QR`);
    if (
      cached.kind !== "link" ||
      cached.untracked ||
      cached.qr?.id !== hex(link.qrId)
    )
      issues.push(`${link.urlCode}: redirect would not count hits as scans`);

    const [rowArchive, eventIds, { oldLink, oldQr }] = await Promise.all([
      archivedRows(db, run._id, link.linkId),
      archivedEventIds(db, run._id, link.linkId),
      archivedOriginals(db, run._id, link),
    ]);
    counts.rowsConverted += rowArchive.length;
    counts.eventsConverted += eventIds.length;
    const convertedRows = await clicks.countDocuments({
      _id: { $in: rowArchive.map((entry) => entry.sourceId) },
      type: "scan",
      urlCode: link.qrCodeId,
    });
    if (convertedRows !== rowArchive.length)
      issues.push(
        `${link.urlCode}: ${rowArchive.length - convertedRows} archived rows are missing or not scans`,
      );
    const marked = await events
      .find(
        { "m.linkId": link.linkId, "m.reattributedBy": run._id },
        { projection: { _id: 1, m: 1 } },
      )
      .toArray();
    const markedIds = new Set(marked.map((event) => hex(event._id)));
    const lost = eventIds.filter((id) => !markedIds.has(hex(id))).length;
    if (lost || marked.length !== eventIds.length)
      issues.push(
        `${link.urlCode}: ${marked.length} reattributed events vs ${eventIds.length} archived (${lost} archived events missing)`,
      );
    if (
      marked.some(
        (event) => event.m.kind !== "scan" || !event.m.qrId?.equals(link.qrId),
      )
    )
      issues.push(`${link.urlCode}: reattributed events lack scan fields`);
    if (now.clickRows) {
      counts.remainingClickRows += now.clickRows;
      issues.push(
        `${link.urlCode}: ${now.clickRows} click rows arrived after conversion; re-run --apply`,
      );
    }
    if (now.clickEvents) {
      counts.remainingClickEvents += now.clickEvents;
      issues.push(
        `${link.urlCode}: ${now.clickEvents} click events remain; re-run --apply`,
      );
    }
    if (now.duplicates) {
      counts.duplicateEvents += now.duplicates;
      issues.push(`${link.urlCode}: ${now.duplicates} duplicated click_events`);
    }
    // Conversion moves records between kinds; only new traffic changes totals.
    const expectedRows =
      link.before.clickRows + link.before.scanRows + now.rowArrivals;
    const expectedEvents =
      link.before.clickEvents + link.before.scanEvents + now.eventArrivals;
    if (now.rows !== expectedRows)
      issues.push(
        `${link.urlCode}: ${now.rows} legacy rows, expected ${expectedRows} (before + arrivals)`,
      );
    if (now.events !== expectedEvents)
      issues.push(
        `${link.urlCode}: ${now.events} click_events, expected ${expectedEvents} (before + arrivals)`,
      );

    const transfer = link.transfer;
    if (!transfer || !oldLink || !oldQr) {
      issues.push(`${link.urlCode}: missing counter transfer or archive`);
      continue;
    }
    counts.clicksTransferred += transfer.clicks;
    const linkTotal = count(linkDoc?.clicks?.total);
    const qrTotal = count(qrDoc?.clicks?.total);
    // The QR's snapshot of the link's history is counted once, not twice.
    const expectedQr = count(oldQr.clicks?.total) + transfer.qrClicks;
    if (linkTotal)
      issues.push(
        `${link.urlCode}: backing link clicks.total is ${linkTotal}; re-run --apply`,
      );
    if (qrTotal < expectedQr)
      issues.push(`${link.urlCode}: QR clicks.total below the transferred sum`);
    if (!arrivals && linkTotal + qrTotal !== expectedQr)
      issues.push(
        `${link.urlCode}: legacy counters ${linkTotal}+${qrTotal} ≠ ${expectedQr} expected`,
      );
    if (
      transfer.legacyTotal &&
      (linkDoc?.stats?.legacyTotal !== 0 ||
        qrDoc?.stats?.legacyTotal !==
          count(oldQr.stats?.legacyTotal) + transfer.qrLegacyTotal)
    )
      issues.push(`${link.urlCode}: stats.legacyTotal transfer mismatch`);
    await derivedCounters(db, link, issues);
  }
  return {
    ok: issues.length === 0,
    quiescent,
    counts,
    discrepancies: issues.slice(0, 200),
  };
}

export async function verifyRolledBack(
  db: Db,
  run: RunDoc,
  linkDomain = "shortn.at",
): Promise<VerifyResult> {
  const issues: string[] = [];
  const counts = {
    links: 0,
    rowsRestored: 0,
    eventsRestored: 0,
    rowArrivals: 0,
    eventArrivals: 0,
  };
  const load = mongoLinkLoader(db, linkDomain);
  const links = db.collection<LinkDoc>(names.links);
  const qrs = db.collection<QrDoc>(names.qr_codes);
  const clicks = db.collection<ClickRow>(names.clicks);
  const events = db.collection<EventDoc>(names.click_events);
  let quiescent = true;
  for (const link of run.links) {
    if (link.conflict) continue;
    counts.links++;
    const [{ oldLink, oldQr }, rowArchive, eventIds] = await Promise.all([
      archivedOriginals(db, run._id, link),
      archivedRows(db, run._id, link.linkId),
      archivedEventIds(db, run._id, link.linkId),
    ]);
    const [linkDoc, qrDoc, cached, now, marked] = await Promise.all([
      links.findOne({ _id: link.linkId }),
      qrs.findOne({ _id: link.qrId }),
      load(linkDomain, link.urlCode),
      snapshot(db, run, link),
      events.countDocuments({
        "m.linkId": link.linkId,
        "m.reattributedBy": run._id,
      }),
    ]);
    const arrivals = now.rowArrivals + now.eventArrivals;
    if (arrivals) quiescent = false;
    counts.rowArrivals += now.rowArrivals;
    counts.eventArrivals += now.eventArrivals;
    if ((linkDoc?.qrCodeId ?? null) !== (oldLink?.qrCodeId ?? null))
      issues.push(`${link.urlCode}: qrCodeId not restored`);
    if (oldLink && !oldLink.qrCodeId && (cached.kind !== "link" || cached.qr))
      issues.push(`${link.urlCode}: redirect still resolves the QR`);
    if (marked)
      issues.push(`${link.urlCode}: ${marked} events still reattributed`);
    const rows = await clicks
      .find(
        { _id: { $in: rowArchive.map((entry) => entry.sourceId) } },
        { projection: { type: 1, urlCode: 1 } },
      )
      .toArray();
    const rowById = new Map(rows.map((row) => [hex(row._id), row]));
    for (const entry of rowArchive) {
      const row = rowById.get(hex(entry.sourceId));
      if (
        row &&
        row.type === entry.doc.type &&
        row.urlCode === entry.doc.urlCode
      )
        counts.rowsRestored++;
      else
        issues.push(`${link.urlCode}: row ${hex(entry.sourceId)} not restored`);
    }
    const restoredEvents = await events.countDocuments({
      "m.linkId": link.linkId,
      "m.kind": "click",
      "m.qrId": { $exists: false },
      _id: { $in: eventIds },
    });
    counts.eventsRestored += restoredEvents;
    if (restoredEvents !== eventIds.length)
      issues.push(
        `${link.urlCode}: ${eventIds.length - restoredEvents} events not restored`,
      );
    if (now.duplicates)
      issues.push(`${link.urlCode}: ${now.duplicates} duplicated click_events`);
    if (!oldLink || !oldQr)
      issues.push(`${link.urlCode}: archive of the link or QR is missing`);
    else if (!arrivals) {
      if (count(linkDoc?.clicks?.total) !== count(oldLink.clicks?.total))
        issues.push(`${link.urlCode}: link clicks.total not restored`);
      if (count(qrDoc?.clicks?.total) !== count(oldQr.clicks?.total))
        issues.push(`${link.urlCode}: QR clicks.total not restored`);
      if (linkDoc?.stats?.legacyTotal !== oldLink.stats?.legacyTotal)
        issues.push(`${link.urlCode}: link stats.legacyTotal not restored`);
      if (qrDoc?.stats?.legacyTotal !== oldQr.stats?.legacyTotal)
        issues.push(`${link.urlCode}: QR stats.legacyTotal not restored`);
    }
    await derivedCounters(db, link, issues);
  }
  return {
    ok: issues.length === 0,
    quiescent,
    counts,
    discrepancies: issues.slice(0, 200),
  };
}

async function restoreLink(ctx: Context, run: RunDoc, link: RunLink) {
  if (link.restored || link.conflict) return;
  const db = ctx.db;
  const links = db.collection<LinkDoc>(names.links);
  const qrs = db.collection<QrDoc>(names.qr_codes);
  const clicks = db.collection<ClickRow>(names.clicks);
  const events = db.collection<EventDoc>(names.click_events);
  const { oldLink, oldQr } = await archivedOriginals(db, run._id, link);
  if (!oldLink || !oldQr)
    throw new Error(
      `Archive of ${link.urlCode} is incomplete; restore manually`,
    );

  await ctx.lease.assert();
  if (link.backfilled)
    await links.updateOne(
      { _id: link.linkId, qrCodeId: link.qrCodeId },
      "qrCodeId" in oldLink
        ? { $set: { qrCodeId: oldLink.qrCodeId ?? null } }
        : { $unset: { qrCodeId: "" } },
    );

  await ctx.lease.assert();
  await events.updateMany(
    { "m.linkId": link.linkId, "m.reattributedBy": run._id },
    {
      $set: { "m.kind": "click" },
      $unset: { "m.qrId": "", "m.reattributedBy": "" },
    },
  );

  const rows = db
    .collection<ArchiveEntry<ClickRow>>(archived.clicks)
    .find({ runId: run._id, linkId: link.linkId });
  let batch: AnyBulkWriteOperation<ClickRow>[] = [];
  const flush = async () => {
    if (!batch.length) return;
    await ctx.lease.assert();
    await clicks.bulkWrite(batch, { ordered: false });
    batch = [];
  };
  for await (const entry of rows) {
    batch.push({
      updateOne: {
        filter: { _id: entry.sourceId, type: "scan", urlCode: link.qrCodeId },
        update:
          "type" in entry.doc
            ? { $set: { type: entry.doc.type ?? null, urlCode: link.urlCode } }
            : { $set: { urlCode: link.urlCode }, $unset: { type: "" } },
      },
    });
    if (batch.length >= ctx.batchSize) await flush();
  }
  await flush();

  const transfer = link.transfer;
  await ctx.lease.assert();
  await inTransaction(ctx.client, async (session) => {
    if (transfer) {
      const linkSet: Document = transfer.legacyTotal
        ? { "stats.legacyTotal": oldLink.stats?.legacyTotal }
        : {};
      if (transfer.clicks || transfer.linkLastClick || transfer.legacyTotal)
        await links.updateOne(
          { _id: link.linkId },
          {
            ...(transfer.clicks
              ? { $inc: { "clicks.total": transfer.clicks } }
              : {}),
            ...(transfer.linkLastClick
              ? { $max: { "clicks.lastClick": transfer.linkLastClick } }
              : {}),
            ...(Object.keys(linkSet).length ? { $set: linkSet } : {}),
          },
          { session },
        );
      const qrInc: Document = {
        ...(transfer.qrClicks ? { "clicks.total": -transfer.qrClicks } : {}),
        ...(transfer.qrLegacyTotal
          ? { "stats.legacyTotal": -transfer.qrLegacyTotal }
          : {}),
      };
      if (Object.keys(qrInc).length)
        await qrs.updateOne({ _id: link.qrId }, { $inc: qrInc }, { session });
      if (transfer.qrTotalMissing)
        await qrs.updateOne(
          { _id: link.qrId, "clicks.total": 0 },
          { $unset: { "clicks.total": "" } },
          { session },
        );
      // Only undo the lastClick we raised; a newer scan keeps its own value.
      if (transfer.qrLastClickAfter)
        await qrs.updateOne(
          { _id: link.qrId, "clicks.lastClick": transfer.qrLastClickAfter },
          transfer.qrLastClickMissing
            ? { $unset: { "clicks.lastClick": "" } }
            : {
                $set: {
                  "clicks.lastClick": transfer.qrLastClickBefore ?? null,
                },
              },
          { session },
        );
    }
    await setLink(ctx, run._id, link.linkId, { restored: true }, session);
  });
  link.restored = true;
}

export async function rollbackReattribution(
  options: ReattributionOptions & { runId: string },
): Promise<{ run: RunDoc; verify: VerifyResult }> {
  if (!isRunId(options.runId))
    throw new Error(`Invalid run id: ${options.runId}`);
  const lease = await acquireMigrationLease(
    options.client,
    options.db,
    options.leaseMs,
  );
  const ctx = context(options, lease);
  const runs = ctx.db.collection<RunDoc>(runsCollection);
  try {
    const run = await runs.findOne({ _id: options.runId });
    if (!run) throw new Error(`Unknown run ${options.runId}`);
    if (run.status === "rolled-back")
      throw new Error(`Run ${run._id} is already rolled back`);
    const touched = run.links.map((link) => link.linkId);
    const later = await runs.findOne({
      _id: { $ne: run._id },
      startedAt: { $gt: run.startedAt },
      status: { $ne: "rolled-back" },
      "links.linkId": { $in: touched },
    });
    if (later)
      throw new Error(
        `Run ${later._id} touched the same links later; roll it back first`,
      );
    await runs.updateOne(
      { _id: run._id },
      { $set: { status: "rolling-back" }, $unset: { error: "" } },
    );
    for (const link of run.links) await restoreLink(ctx, run, link);
    const active = run.links.filter((link) => !link.conflict);
    if (options.invalidate)
      await options.invalidate(active.map((link) => link.urlCode));
    await ctx.onPhase("rolled-back-links", run._id);
    await ctx.lease.assert();
    const ids = active.map((link) => link.linkId);
    const [first] = await ctx.db
      .collection<EventDoc>(names.click_events)
      .find({ "m.linkId": { $in: ids } }, { projection: { ts: 1 } })
      .sort({ ts: 1 })
      .limit(1)
      .toArray();
    if (first) await recomputeRollups(ctx.db, first.ts, new Date(), ids);
    const stored = await runs.findOne({ _id: run._id });
    if (!stored) throw new Error(`Run ${run._id} disappeared`);
    const verify = await verifyRolledBack(ctx.db, stored, options.linkDomain);
    await runs.updateOne(
      { _id: run._id },
      verify.ok
        ? {
            $set: {
              status: "rolled-back",
              rolledBackAt: new Date(),
              rollbackVerify: verify,
            },
          }
        : { $set: { rollbackVerify: verify } },
    );
    return { run: { ...stored, rollbackVerify: verify }, verify };
  } catch (error) {
    await runs
      .updateOne(
        { _id: options.runId, status: "rolling-back" },
        {
          $set: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      )
      .catch(() => undefined);
    throw error;
  } finally {
    await lease.release().catch(() => undefined);
  }
}

export async function verifyRun(db: Db, runId: string, linkDomain?: string) {
  const run = await db
    .collection<RunDoc>(runsCollection)
    .findOne({ _id: runId });
  if (!run) throw new Error(`Unknown run ${runId}`);
  return run.status === "rolled-back" || run.status === "rolling-back"
    ? verifyRolledBack(db, run, linkDomain)
    : verifyApplied(db, run, linkDomain);
}

export async function listRuns(db: Db) {
  return db
    .collection<RunDoc>(runsCollection)
    .find({}, { projection: { links: 0, skipped: 0 }, sort: { startedAt: 1 } })
    .toArray();
}

export async function sampleDiffs(db: Db, plan: Plan, limit = 3) {
  const lines: string[] = [];
  for (const link of plan.links.slice(0, limit)) {
    const [row, event] = await Promise.all([
      db
        .collection<ClickRow>(names.clicks)
        .findOne(clickRowFilter(link.urlCode), { sort: { _id: -1 } }),
      db
        .collection<EventDoc>(names.click_events)
        .findOne(convertibleEvents(link.linkId), { sort: { ts: -1 } }),
    ]);
    const after = predictedAfter(link);
    lines.push(
      `  link ${hex(link.linkId)}: qrCodeId "" → "${link.qrCodeId}", clicks.total ${link.before.linkTotal} → 0`,
      `  qr   ${hex(link.qrId)}: clicks.total ${link.before.qrTotal} → ${after.qrTotal}`,
    );
    if (row)
      lines.push(
        `  clicks ${hex(row._id)}: type ${row.type ?? "(unset)"} → scan, urlCode ${row.urlCode} → ${link.qrCodeId}`,
      );
    if (event)
      lines.push(
        `  click_events ${hex(event._id)}: m.kind click → scan, m.qrId (unset) → ${hex(link.qrId)}, m.reattributedBy (unset) → <runId>`,
      );
  }
  return lines;
}

const tally = <T extends string | number>(values: T[]) => {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b)))
    .map(([key, n]) => `${key}: ${n}`)
    .join(", ");
};

export function formatPlan(plan: Plan, samples: string[], runs: RunDoc[]) {
  const sum = (pick: (link: PlannedLink) => number) =>
    plan.links.reduce((total, link) => total + pick(link), 0);
  const legacyMoves = plan.links.filter(
    (link) =>
      link.before.linkLegacyTotal !== null &&
      link.before.qrLegacyTotal !== null,
  );
  const lines = [
    "Legacy QR reattribution — dry run (no writes)",
    `QR codes ${plan.totals.qrCodes}; backing links ${plan.totals.backingLinks}, ${plan.totals.withoutQrCodeId} without qrCodeId`,
    `Planned ${plan.links.length} QR codes (${plan.links.filter((link) => link.sweep).length} sweeps of earlier runs); skipped ${plan.skipped.length}`,
    "",
    "Changes per collection:",
    `  ${names.links}: ${plan.links.filter((link) => !link.sweep).length} qrCodeId backfills; clicks.total moved off ${plan.links.filter((link) => link.before.linkTotal).length} links (${sum((link) => link.before.linkTotal)} hits); stats recomputed for ${plan.links.length}`,
    `  ${names.qr_codes}: clicks.total +${sum((link) => Math.max(0, link.before.linkTotal - link.before.qrTotal))} across ${plan.links.length}; stats.legacyTotal moved for ${legacyMoves.length} (+${legacyMoves.reduce((total, link) => total + Math.max(0, (link.before.linkLegacyTotal ?? 0) - (link.before.qrLegacyTotal ?? 0)), 0)})`,
    `  ${names.clicks}: ${sum((link) => link.before.clickRows)} rows click → scan (urlCode → qrCodeId)`,
    `  ${names.click_events}: ${sum((link) => link.before.clickEvents)} events click → scan (${sum((link) => link.before.legacyClickEvents)} legacy-copied, ${sum((link) => link.before.liveClickEvents)} live)`,
    `  ${names.click_rollups}: ${sum((link) => link.before.rollups)} docs recomputed`,
    "",
    "Risk signals:",
    `  rows with a referrer (possible non-scan visits): ${sum((link) => link.before.rowsWithReferrer)} of ${sum((link) => link.before.clickRows)}`,
    `  links with clicks recorded before their QR was created: ${plan.links.filter((link) => link.qrCreated && link.before.firstClickRow && link.before.firstClickRow < link.qrCreated).length}`,
    `  URL encoded in the QR: ${tally(plan.links.map((link) => link.encodedPath)) || "-"}`,
    `  qrCodeId lengths: ${tally(plan.links.map((link) => link.qrCodeId.length)) || "-"}; urlCode lengths: ${tally(plan.links.map((link) => link.urlCode.length)) || "-"}`,
    `  scan rows already on these QR codes: ${sum((link) => link.before.scanRows)}`,
    `  orphan click events (linkId null) with these codes, left unchanged: ${plan.orphanEvents}`,
    "",
    `Skipped (${plan.skipped.length}):`,
    ...plan.skipped.map(
      (skip) =>
        `  ${skip.reason.padEnd(20)} ${skip.urlCode.padEnd(12)} link ${hex(skip.linkId)} qrs [${skip.qrIds.map(hex).join(",")}] clickRows ${skip.clickRows} — ${skip.detail}`,
    ),
    "",
    "Per QR (before → after): rows click/scan | events click/scan | clicks.total link/qr | legacyTotal link/qr",
    ...plan.links.map((link) => {
      const { before } = link;
      const after = predictedAfter(link);
      return `  ${link.qrCodeId.padEnd(10)} ${link.urlCode.padEnd(10)} rows ${before.clickRows}/${before.scanRows} → ${after.clickRows}/${after.scanRows} | events ${before.clickEvents}/${before.scanEvents} → ${after.clickEvents}/${after.scanEvents} | total ${before.linkTotal}/${before.qrTotal} → ${after.linkTotal}/${after.qrTotal} | legacy ${before.linkLegacyTotal ?? "-"}/${before.qrLegacyTotal ?? "-"} → ${after.linkLegacyTotal ?? "-"}/${after.qrLegacyTotal ?? "-"}${link.sweep ? " (sweep)" : ""}`;
    }),
    "",
    "Sample diffs:",
    ...(samples.length ? samples : ["  (none)"]),
    "",
    `Earlier runs (${runs.length}):`,
    ...runs.map(
      (run) =>
        `  ${run._id} ${run.status} started ${run.startedAt.toISOString()}${run.verify ? ` verify ok=${run.verify.ok}` : ""}`,
    ),
    ...runs.flatMap((run) =>
      run.status === "applying"
        ? [`NOTE: ${run._id} is incomplete; --apply resumes it`]
        : run.status === "rolling-back"
          ? [`NOTE: ${run._id} stopped mid-rollback; re-run --rollback`]
          : [],
    ),
  ];
  return lines.join("\n");
}

export function formatVerify(title: string, verify: VerifyResult) {
  return [
    `${title}: ok=${verify.ok} quiescent=${verify.quiescent}`,
    `  ${Object.entries(verify.counts)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`,
    ...verify.discrepancies.map((issue) => `  ! ${issue}`),
  ].join("\n");
}
