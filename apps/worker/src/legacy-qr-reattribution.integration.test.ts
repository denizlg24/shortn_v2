import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mongoLinkLoader, recomputeRollups } from "@shortn/core";
import { physicalNames as names, syncIndexes } from "@shortn/db";
import { productionMigrations, runMigrations } from "@shortn/db/migrations";
import type { MigrationState } from "@shortn/db/migrations";
import { MongoClient, ObjectId } from "mongodb";
import type { Db, Document } from "mongodb";
import { writeBatch } from "./ingest";
import type { Decoded } from "./ingest";
import {
  applyReattribution,
  buildPlan,
  formatPlan,
  rollbackReattribution,
  runsCollection,
  sampleDiffs,
  verifyRun,
} from "./legacy-qr-reattribution";
import type {
  Phase,
  ReattributionOptions,
  RunDoc,
} from "./legacy-qr-reattribution";

const mongoUrl = process.env.MONGO_TEST_URL;
if (!mongoUrl)
  console.log("SKIP legacy QR reattribution integration: set MONGO_TEST_URL");
if (!mongoUrl && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("MONGO_TEST_URL required when REQUIRE_INTEGRATION=1");

const ipSecret = "ip-hash-fixture-secret-0123456789abcdef";
const browser =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const owner = "google|owner";
const quiet = () => {};
const clickEventsBackfill = productionMigrations.find(
  (migration) => migration.id === "0007-click-events-backfill",
);
const day = (n: number) => new Date(Date.UTC(2024, 4, n, 12));

let sequence = 0;
function hit(linkId: ObjectId, key: string, qrId?: ObjectId): Decoded {
  sequence++;
  return {
    sid: `${Date.now()}-${sequence}`,
    message: {
      v: 1,
      ts: Date.now(),
      linkId: linkId.toHexString(),
      ...(qrId ? { qrId: qrId.toHexString() } : {}),
      domain: "shortn.at",
      key,
      bot: false,
      ua: browser,
      ip: "203.0.113.9",
      query: {},
    },
  };
}

const legacyRow = (urlCode: string, timestamp: Date, type?: string) => ({
  urlCode,
  sub: owner,
  ...(type ? { type } : {}),
  timestamp,
  ip: "198.51.100.7",
  userAgent: browser,
  pathname: `/${urlCode}`,
  queryParams: {},
});

interface Fixture {
  affectedLink: ObjectId;
  affectedQr: ObjectId;
  healthyLink: ObjectId;
  healthyQr: ObjectId;
  visibleLink: ObjectId;
}

(mongoUrl ? describe : describe.skip)("legacy QR reattribution", () => {
  let client: MongoClient;
  const databases: Db[] = [];

  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(mongoUrl ?? "").hostname))
      throw new Error(
        "Integration tests only connect to local fixture services",
      );
    process.env.IP_HASH_SECRET = ipSecret;
    client = await new MongoClient(mongoUrl ?? "").connect();
  });

  afterAll(async () => {
    for (const db of databases) await db.dropDatabase();
    await client?.close();
  });

  async function fresh(): Promise<{ db: Db; ids: Fixture }> {
    const db = client.db(
      `shortn_lqr_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    );
    databases.push(db);
    for (const name of [
      names.links,
      names.qr_codes,
      names.clicks,
      names.bio_pages,
      names.campaigns,
      names.tags,
      names.link_reports,
      names.scheduled_changes,
      names.contacts,
      names.rate_limits,
      names.user,
      names.session,
      names.account,
      names.verification,
      names.admin_audit_log,
      names.meta,
      names.login_records,
    ])
      await db.createCollection(name);
    await syncIndexes(db, { log: quiet });

    const links = db.collection(names.links);
    const qrs = db.collection(names.qr_codes);
    const backing = (urlCode: string, qrCodeId: string, total: number) => ({
      _id: new ObjectId(),
      urlCode,
      longUrl: `https://example.com/${urlCode}`,
      sub: owner,
      isQrCode: true,
      qrCodeId,
      clicks: { total, lastClick: total ? day(9) : null },
    });
    const affected = backing("bkA", "", 4);
    const healthy = backing("bkB", "QB", 0);
    const ambiguous = backing("bkC", "", 1);
    const orphan = backing("bkD", "", 1);
    const shared = backing("bkE", "", 1);
    const nullRef = backing("bkF", "", 1);
    const visible = {
      _id: new ObjectId(),
      urlCode: "vis",
      longUrl: "https://example.com/vis",
      sub: owner,
      isQrCode: false,
      clicks: { total: 2, lastClick: day(3) },
    };
    await links.insertMany([
      affected,
      healthy,
      ambiguous,
      orphan,
      shared,
      nullRef,
      visible,
    ]);
    const qr = (qrCodeId: string, urlId: string, linkId?: ObjectId) => ({
      _id: new ObjectId(),
      qrCodeId,
      urlId,
      sub: owner,
      date: day(1),
      ...(linkId ? { linkId } : {}),
      options: { data: `https://shortn.at/qr/${urlId}` },
      clicks: { total: 0, lastClick: null },
    });
    const affectedQr = qr("QA1234567", "bkA", affected._id);
    const healthyQr = {
      ...qr("QB", "bkB"),
      clicks: { total: 2, lastClick: day(4) },
    };
    await qrs.insertMany([
      affectedQr,
      healthyQr,
      qr("QC1", "bkC"),
      qr("QC2", "bkC"),
      qr("QDUP", "bkE"),
      qr("QDUP", "elsewhere"),
      { ...qr("QF", "bkF"), linkId: null },
    ]);
    await db
      .collection(names.clicks)
      .insertMany([
        legacyRow("bkA", day(2), "click"),
        legacyRow("bkA", day(5), "click"),
        legacyRow("bkA", day(7), "click"),
        legacyRow("bkA", day(9)),
        legacyRow("QB", day(4), "scan"),
        legacyRow("QB", day(6), "scan"),
        legacyRow("vis", day(2), "click"),
        legacyRow("vis", day(3), "click"),
        legacyRow("bkC", day(3), "click"),
        legacyRow("bkD", day(3), "click"),
        legacyRow("bkE", day(3), "click"),
      ]);
    if (!clickEventsBackfill) throw new Error("0007 is not registered");
    await runMigrations(client, db, [clickEventsBackfill], { log: quiet });
    await writeBatch(
      db,
      [
        hit(affected._id, "bkA"),
        hit(affected._id, "bkA"),
        hit(visible._id, "vis"),
        hit(healthy._id, "bkB", healthyQr._id),
      ],
      { redelivered: false, ipSecret },
    );
    await recomputeRollups(db, day(1), new Date());
    return {
      db,
      ids: {
        affectedLink: affected._id,
        affectedQr: affectedQr._id,
        healthyLink: healthy._id,
        healthyQr: healthyQr._id,
        visibleLink: visible._id,
      },
    };
  }

  const options = (
    db: Db,
    onPhase?: (phase: Phase, runId: string) => Promise<void>,
  ): ReattributionOptions => ({
    client,
    db,
    settleMs: 0,
    leaseMs: 2000,
    log: quiet,
    ...(onPhase ? { onPhase } : {}),
  });

  const normalize = (value: unknown): unknown => {
    if (value instanceof ObjectId) return `oid:${value.toHexString()}`;
    if (value instanceof Date) return `date:${value.toISOString()}`;
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, normalize(Reflect.get(value, key))]),
      );
    return value;
  };
  async function dump(db: Db) {
    const read = async (name: string, strip: string[] = []) =>
      (await db.collection(name).find().toArray())
        .map((doc: Document) =>
          normalize(
            Object.fromEntries(
              Object.entries(doc).filter(([key]) => !strip.includes(key)),
            ),
          ),
        )
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return {
      links: await read(names.links),
      qrs: await read(names.qr_codes),
      clicks: await read(names.clicks),
      events: await read(names.click_events),
      rollups: await read(names.click_rollups, ["_id"]),
    };
  }

  const eventsOf = (db: Db, linkId: ObjectId) =>
    db.collection(names.click_events).find({ "m.linkId": linkId }).toArray();

  test("dry run reports the affected code, skips ambiguous mappings and writes nothing", async () => {
    const { db, ids } = await fresh();
    const before = await dump(db);
    const plan = await buildPlan(db);
    const report = formatPlan(plan, await sampleDiffs(db, plan), []);

    expect(plan.links.map((link) => link.urlCode)).toEqual(["bkA"]);
    const [link] = plan.links;
    expect(link?.qrId.equals(ids.affectedQr)).toBe(true);
    expect(link?.encodedPath).toBe("qr-path");
    expect(link?.before).toMatchObject({
      clickRows: 6,
      scanRows: 0,
      clickEvents: 6,
      legacyClickEvents: 4,
      liveClickEvents: 2,
      linkTotal: 6,
      qrTotal: 0,
      linkLegacyTotal: 4,
      qrLegacyTotal: 0,
    });
    expect(
      Object.fromEntries(
        plan.skipped.map((skip) => [skip.urlCode, skip.reason]),
      ),
    ).toEqual({
      bkC: "multiple-qrs",
      bkD: "no-qr",
      bkE: "duplicate-qr-code",
      bkF: "qr-linked-elsewhere",
    });
    expect(report).toContain("6 rows click → scan");
    expect(report).toContain("total 6/0 → 0/6");
    expect(await dump(db)).toEqual(before);
    expect(await db.listCollections({ name: runsCollection }).hasNext()).toBe(
      false,
    );
  });

  test("apply reattributes history everywhere and new scans count as scans", async () => {
    const { db, ids } = await fresh();
    const before = await dump(db);
    const result = await applyReattribution(options(db));
    expect(result.verify).toMatchObject({ ok: true, quiescent: true });
    expect(result.verify?.counts).toMatchObject({
      rowsConverted: 6,
      eventsConverted: 6,
      clicksTransferred: 6,
    });

    const link = await db
      .collection(names.links)
      .findOne({ _id: ids.affectedLink });
    expect(link).toMatchObject({
      qrCodeId: "QA1234567",
      clicks: { total: 0, lastClick: null },
      stats: { legacyTotal: 0, clicks: 0, scans: 6 },
    });
    const qr = await db
      .collection(names.qr_codes)
      .findOne({ _id: ids.affectedQr });
    expect(qr).toMatchObject({
      clicks: { total: 6, lastClick: day(9) },
      stats: { legacyTotal: 4 },
    });
    const clicks = db.collection(names.clicks);
    expect(await clicks.countDocuments({ urlCode: "bkA" })).toBe(0);
    expect(
      await clicks.countDocuments({
        urlCode: "QA1234567",
        type: "scan",
        sub: owner,
      }),
    ).toBe(6);
    const events = await eventsOf(db, ids.affectedLink);
    expect(events).toHaveLength(6);
    for (const event of events) {
      expect(event.m.kind).toBe("scan");
      expect(event.m.qrId).toEqual(ids.affectedQr);
      expect(event.m.reattributedBy).toBe(result.run?._id);
    }
    const rollups = await db
      .collection(names.click_rollups)
      .find({ linkId: ids.affectedLink })
      .toArray();
    expect(rollups.reduce((n, row) => n + row.clicks, 0)).toBe(0);
    expect(rollups.reduce((n, row) => n + row.scans, 0)).toBe(6);

    const after = await dump(db);
    const untouched = (dumped: Awaited<ReturnType<typeof dump>>) => ({
      links: dumped.links.filter((doc) => !JSON.stringify(doc).includes("bkA")),
      qrs: dumped.qrs.filter(
        (doc) => !JSON.stringify(doc).includes("QA1234567"),
      ),
      clicks: dumped.clicks.filter(
        (doc) => !/"(bkA|QA1234567)"/.test(JSON.stringify(doc)),
      ),
      events: dumped.events.filter(
        (doc) => !JSON.stringify(doc).includes(ids.affectedLink.toHexString()),
      ),
    });
    expect(untouched(after)).toEqual(untouched(before));

    const cached = await mongoLinkLoader(db)("shortn.at", "bkA");
    expect(cached.kind === "link" && cached.qr?.id).toBe(
      ids.affectedQr.toHexString(),
    );
    expect(cached.kind === "link" && cached.untracked).toBeFalsy();
    if (cached.kind !== "link" || !cached.qr) throw new Error("not a QR link");
    await writeBatch(
      db,
      [hit(new ObjectId(cached.id), "bkA", new ObjectId(cached.qr.id))],
      { redelivered: false, ipSecret },
    );
    expect(
      await clicks.countDocuments({ urlCode: "QA1234567", type: "scan" }),
    ).toBe(7);
    expect(
      (await db.collection(names.qr_codes).findOne({ _id: ids.affectedQr }))
        ?.clicks.total,
    ).toBe(7);
    expect(
      (await db.collection(names.links).findOne({ _id: ids.affectedLink }))
        ?.clicks.total,
    ).toBe(0);
  });

  test("re-running apply and running 0007 afterwards change nothing", async () => {
    const { db, ids } = await fresh();
    let lockedOut: unknown;
    await applyReattribution(
      options(db, async (phase) => {
        if (phase !== "backfilled" || !clickEventsBackfill) return;
        lockedOut = await runMigrations(client, db, [clickEventsBackfill], {
          log: quiet,
        }).catch((error: Error) => error.message);
      }),
    );
    expect(String(lockedOut)).toContain("lock held");
    const applied = await dump(db);

    const again = await applyReattribution(options(db));
    expect(again.run).toBeNull();
    expect(again.plan?.links).toHaveLength(0);
    expect(await dump(db)).toEqual(applied);

    if (!clickEventsBackfill) throw new Error("0007 is not registered");
    await runMigrations(client, db, [clickEventsBackfill], { log: quiet });
    const events = await db.collection(names.click_events).find().toArray();
    expect(events).toHaveLength(applied.events.length);
    const legacyIds = events.flatMap((event) =>
      event.legacyId ? [event.legacyId.toHexString()] : [],
    );
    expect(new Set(legacyIds).size).toBe(legacyIds.length);
    expect(
      (await eventsOf(db, ids.affectedLink)).every(
        (event) => event.m.kind === "scan",
      ),
    ).toBe(true);
    expect(await db.collection<RunDoc>(runsCollection).countDocuments()).toBe(
      1,
    );
  });

  test("live traffic mid-run is attributed correctly and late stragglers are swept", async () => {
    const { db, ids } = await fresh();
    const inject = async (phase: Phase) => {
      if (phase === "backfilled")
        await writeBatch(
          db,
          [
            hit(ids.affectedLink, "bkA"),
            hit(ids.affectedLink, "bkA", ids.affectedQr),
          ],
          { redelivered: false, ipSecret },
        );
      if (phase === "events")
        await writeBatch(db, [hit(ids.affectedLink, "bkA")], {
          redelivered: false,
          ipSecret,
        });
    };
    const first = await applyReattribution(options(db, inject));
    expect(first.verify?.ok).toBe(false);
    expect(first.verify?.quiescent).toBe(false);
    expect(first.verify?.discrepancies).toEqual([
      "bkA: 1 click rows arrived after conversion; re-run --apply",
    ]);
    expect(first.verify?.counts).toMatchObject({
      rowsConverted: 7,
      eventsConverted: 8,
      clicksTransferred: 8,
    });

    const sweep = await applyReattribution(options(db));
    expect(sweep.plan?.links.map((link) => [link.urlCode, link.sweep])).toEqual(
      [["bkA", true]],
    );
    expect(sweep.verify).toMatchObject({ ok: true, quiescent: true });
    const clicks = db.collection(names.clicks);
    expect(await clicks.countDocuments({ urlCode: "bkA" })).toBe(0);
    expect(
      await clicks.countDocuments({ urlCode: "QA1234567", type: "scan" }),
    ).toBe(9);
    const events = await eventsOf(db, ids.affectedLink);
    expect(events.filter((event) => event.m.kind === "scan")).toHaveLength(9);
    expect(
      events.filter((event) => event.m.reattributedBy === first.run?._id),
    ).toHaveLength(8);
    expect(
      (await db.collection(names.qr_codes).findOne({ _id: ids.affectedQr }))
        ?.clicks.total,
    ).toBe(9);
    expect((await verifyRun(db, first.run?._id ?? "")).ok).toBe(true);

    await expect(
      rollbackReattribution({ ...options(db), runId: first.run?._id ?? "" }),
    ).rejects.toThrow("roll it back first");
  });

  test("an interrupted run resumes without double-counting", async () => {
    const { db, ids } = await fresh();
    let crash = true;
    await expect(
      applyReattribution(
        options(db, async (phase) => {
          if (phase === "rows" && crash) {
            crash = false;
            throw new Error("simulated crash");
          }
        }),
      ),
    ).rejects.toThrow("simulated crash");
    const stalled = await db
      .collection<RunDoc>(runsCollection)
      .findOne({ status: "applying" });
    expect(stalled?.error).toBe("simulated crash");
    const lock = await db
      .collection<MigrationState>("_migrations")
      .findOne({ _id: "lock" });
    expect(lock?.holder).toBeNull();

    const resumed = await applyReattribution(options(db));
    expect(resumed.run?._id).toBe(stalled?._id);
    expect(resumed.verify).toMatchObject({ ok: true, quiescent: true });
    expect(
      (await db.collection(names.qr_codes).findOne({ _id: ids.affectedQr }))
        ?.clicks.total,
    ).toBe(6);
  });

  test("rollback restores every document exactly", async () => {
    const { db, ids } = await fresh();
    const before = await dump(db);
    const applied = await applyReattribution(options(db));
    const runId = applied.run?._id ?? "";
    const rolledBack = await rollbackReattribution({ ...options(db), runId });
    expect(rolledBack.verify).toMatchObject({ ok: true, quiescent: true });
    expect(await dump(db)).toEqual(before);
    const run = await db
      .collection<RunDoc>(runsCollection)
      .findOne({ _id: runId });
    expect(run?.status).toBe("rolled-back");
    const cached = await mongoLinkLoader(db)("shortn.at", "bkA");
    expect(cached.kind === "link" && cached.qr).toBeFalsy();
    expect(
      await db
        .collection(`archive_${names.clicks}_legacy-qr-reattribution`)
        .countDocuments({ runId, linkId: ids.affectedLink }),
    ).toBe(6);

    const reapplied = await applyReattribution(options(db));
    expect(reapplied.verify?.ok).toBe(true);
    expect(reapplied.run?._id).not.toBe(runId);
  });
});
