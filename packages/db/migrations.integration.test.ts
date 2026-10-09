import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId } from "mongodb";
import type { Db } from "mongodb";
import { physicalNames as names } from "./collections";
import { syncIndexes } from "./indexes";
import { productionMigrations } from "./migrations/registry";
import { runMigrations } from "./migrations/runner";
import type { MigrationState } from "./migrations/runner";

const url = process.env.MONGO_TEST_URL;
if (!url)
  console.log("SKIP production migrations integration: set MONGO_TEST_URL");
if (!url && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("MONGO_TEST_URL required when REQUIRE_INTEGRATION=1");
const quiet = () => {};
// 0012 copies Pinata files to S3; it has no local fixture service.
const migrations = productionMigrations.filter(
  (migration) => migration.id !== "0012-assets-to-storage",
);

const alice = new ObjectId();
const bob = new ObjectId();
const subA = "google|alice";
const subB = "github|bob";
const pastDate = new Date("2026-09-15T10:00:00Z");
const oldDate = new Date("2026-03-01T10:00:00Z");

async function seed(db: Db) {
  const abcId = new ObjectId();
  await db.collection(names.user).insertMany([
    {
      _id: alice,
      name: "Alice Ávila",
      email: "alice@example.com",
      username: "alice",
      sub: subA,
      links_this_month: 7,
      qr_codes_this_month: 1,
    },
    { _id: bob, name: "Bob", email: "bob@example.com", sub: subB },
  ]);
  const tagId = "tag-1";
  const campaign = new ObjectId();
  const links = [
    {
      _id: abcId,
      urlCode: "abc",
      longUrl: "https://example.com/a",
      sub: subA,
      date: pastDate,
      tags: [{ id: tagId, tagName: "News", sub: subA }],
      utmLinks: [
        {
          source: "x",
          medium: "social",
          campaign: { _id: campaign, title: "Launch" },
        },
      ],
      clicks: { total: 40, lastClick: pastDate },
      passwordProtected: true,
      passwordHash: "$2a$10$hash",
      safetyStatus: "safe",
    },
    {
      urlCode: "dup",
      longUrl: "https://example.com/first",
      sub: subA,
      date: pastDate,
    },
    {
      urlCode: "dup",
      longUrl: "https://example.com/second",
      sub: subB,
      date: pastDate,
    },
    {
      urlCode: "qr1",
      longUrl: "https://example.com/qr",
      sub: subB,
      isQrCode: true,
      qrCodeId: "Q1",
      date: pastDate,
      tags: [{ id: "tag-2", tagName: "print", sub: subB }],
    },
    {
      urlCode: "orphan",
      longUrl: "https://example.com/o",
      sub: "gone|user",
      date: pastDate,
    },
  ];
  await db.collection(names.links).insertMany(links);

  await db.collection(names.qr_codes).insertOne({
    qrCodeId: "Q1",
    urlId: "qr1",
    sub: subB,
    options: { data: "https://shortn.at/qr1", width: 300 },
    date: pastDate,
    clicks: { total: 5 },
  });
  await db.collection(names.tags).insertMany([
    { sub: subA, id: tagId, tagName: "News" },
    { sub: subA, id: "tag-3", tagName: "news" },
  ]);
  await db.collection(names.campaigns).insertOne({
    _id: campaign,
    sub: subA,
    title: "Launch",
    links: [abcId],
  });
  await db.collection(names.bio_pages).insertOne({
    userId: subA,
    slug: "Alice_Page",
    title: "Alice",
    avatarUrl: "https://example.com/a.png",
    links: [{ link: abcId, title: "My link" }],
    socials: [{ platform: "x", url: "https://x.com/alice" }],
    theme: { font: "Inter", header: { headerStyle: "centered" } },
    createdAt: pastDate,
  });
  await db.collection(names.clicks).insertMany([
    {
      urlCode: "abc",
      sub: subA,
      type: "click",
      timestamp: oldDate,
      ip: "203.0.113.9",
      userAgent: "Mozilla",
      queryParams: { utm_source: "news" },
    },
    {
      urlCode: "Q1",
      sub: subB,
      type: "scan",
      timestamp: new Date(),
      ip: "198.51.100.1",
      userAgent: "Mozilla",
    },
    { urlCode: "deleted-code", sub: subA, type: "click", timestamp: pastDate },
    {
      urlCode: "abc",
      sub: subA,
      type: "click",
      src: "v2",
      timestamp: new Date(),
    },
  ]);
  for (const name of [
    names.link_reports,
    names.scheduled_changes,
    names.contacts,
    names.rate_limits,
    names.session,
    names.account,
    names.verification,
    names.admin_audit_log,
    names.meta,
    names.login_records,
  ])
    await db.createCollection(name);
  await db
    .collection(names.link_reports)
    .insertOne({ urlCode: "abc", reason: "spam" });
  return { abcId, campaign };
}

(url ? describe : describe.skip)("production migrations", () => {
  let client: MongoClient;
  let db: Db;
  let polar: ReturnType<typeof Bun.serve> | undefined;
  beforeAll(async () => {
    if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
      throw new Error(
        "Integration tests only connect to local fixture services",
      );
    client = await new MongoClient(url, {
      serverSelectionTimeoutMS: 10_000,
    }).connect();
    db = client.db(
      `shortn_foundation_test_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    process.env.IP_HASH_SECRET = "ip-hash-fixture-secret-0123456789abcdef";
    process.env.POLAR_ACCESS_TOKEN = "polar-fixture";
    process.env.POLAR_ENVIRONMENT = "sandbox";
    polar = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({
          items: [
            {
              id: "sub_1",
              status: "active",
              current_period_start: "2026-10-01T00:00:00Z",
              current_period_end: "2026-11-01T00:00:00Z",
              cancel_at_period_end: false,
              customer_id: "cus_1",
              product_id: "prod_pro",
              product: { name: "Pro Plan" },
              customer: { external_id: String(alice) },
            },
          ],
          pagination: { max_page: 1 },
        }),
    });
    process.env.POLAR_API_URL = `http://127.0.0.1:${polar.port}`;
  }, 15_000);
  afterAll(async () => {
    await polar?.stop();
    await db?.dropDatabase();
    await client?.close();
  });

  test("up → verify → legacy writes → continuous → down → up", async () => {
    const { abcId, campaign } = await seed(db);
    await syncIndexes(db, { log: quiet });
    const reports = await runMigrations(client, db, migrations, { log: quiet });
    for (const [id, result] of Object.entries(reports))
      expect({
        id,
        ok: result.ok,
        discrepancies: result.discrepancies,
      }).toEqual({ id, ok: true, discrepancies: [] });

    const workspaces = await db
      .collection(names.workspaces)
      .find({ personal: true })
      .toArray();
    expect(workspaces).toHaveLength(2);
    const aliceWs = workspaces.find((ws) => ws.ownerUserId === String(alice));
    expect(aliceWs?.slug).toBe(`alice-${String(alice).slice(-6)}`);
    expect(aliceWs?.plan).toBe("pro");
    const orphanWs = await db
      .collection(names.workspaces)
      .findOne({ slug: "orphaned-legacy-data" });
    expect(
      await db
        .collection(names.links)
        .countDocuments({ workspaceId: orphanWs?._id }),
    ).toBe(1);

    const abc = await db.collection(names.links).findOne({ _id: abcId });
    expect(abc).toMatchObject({
      domain: "shortn.at",
      key: "abc",
      destination: "https://example.com/a",
      previousKeys: [],
      password: { hash: "$2a$10$hash" },
      safety: { status: "safe", disabled: false, interstitial: false },
      stats: { legacyTotal: 40 },
      workspaceId: aliceWs?._id,
    });
    expect(abc?.tagIds).toHaveLength(1);
    expect(abc?.utmVariants).toEqual([
      expect.objectContaining({
        source: "x",
        medium: "social",
        campaignId: campaign,
      }),
    ]);
    const dups = await db
      .collection(names.links)
      .find({ urlCode: "dup" })
      .sort({ _id: 1 })
      .toArray();
    expect(dups.map((doc) => doc.key)).toEqual(["dup", "dup-2"]);
    expect(await db.collection(names.code_conflicts).countDocuments()).toBe(1);

    const tags = await db
      .collection(names.tags)
      .find({ nameLower: "news" })
      .toArray();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.legacyIds?.sort()).toEqual(["tag-1", "tag-3"]);
    expect(
      await db
        .collection(names.tags)
        .countDocuments({ mergedInto: tags[0]?._id }),
    ).toBe(1);

    const qr = await db.collection(names.qr_codes).findOne({ qrCodeId: "Q1" });
    const qrLink = await db.collection(names.links).findOne({ urlCode: "qr1" });
    expect(qr).toMatchObject({
      linkId: qrLink?._id,
      publicId: "Q1",
      design: { width: 300 },
    });

    const events = await db.collection(names.click_events).find({}).toArray();
    expect(events).toHaveLength(3);
    const scan = events.find((event) => event.m.kind === "scan");
    expect(scan?.m).toMatchObject({
      linkId: qrLink?._id,
      qrId: qr?._id,
      key: "qr1",
      legacyCode: "Q1",
    });
    expect(
      events.find((event) => event.m.legacyCode === "deleted-code")?.m.linkId,
    ).toBeNull();
    expect(events.find((event) => event.m.legacyCode === "abc")?.utm).toEqual({
      source: "news",
    });
    expect(await db.collection(names.click_ips).countDocuments()).toBe(1);

    const bio = await db.collection(names.bio_pages).findOne({});
    expect(bio?.handle).toBe("alice-page");
    expect(bio?.blocks.map((block: { type: string }) => block.type)).toEqual([
      "profile",
      "socials",
      "link",
    ]);
    expect(
      await db.collection(names.bio_aliases).findOne({ slug: "Alice_Page" }),
    ).toMatchObject({ bioPageId: bio?._id });

    const usage = await db.collection(names.usage_periods).findOne({
      workspaceId: aliceWs?._id,
      period: new Date().toISOString().slice(0, 7),
    });
    expect(usage).toMatchObject({ links: 7, qrCodes: 1 });
    expect(
      await db.collection(names.subscriptions).countDocuments({ plan: "pro" }),
    ).toBe(1);
    expect(
      await db
        .collection(names.link_reports)
        .countDocuments({ workspaceId: aliceWs?._id }),
    ).toBe(1);

    // Legacy keeps writing: a rename, a destination change, a new link and a new click.
    await db
      .collection(names.links)
      .updateOne(
        { _id: abcId },
        { $set: { urlCode: "renamed", longUrl: "https://example.com/b" } },
      );
    await db.collection(names.links).insertOne({
      urlCode: "fresh",
      longUrl: "https://example.com/f",
      sub: subB,
      date: new Date(),
    });
    await db.collection(names.clicks).insertOne({
      urlCode: "fresh",
      sub: subB,
      type: "click",
      timestamp: new Date(),
    });
    const continuous = productionMigrations.filter(
      (migration) => migration.continuous,
    );
    const rerun = await runMigrations(client, db, continuous, { log: quiet });
    for (const result of Object.values(rerun))
      expect(result.discrepancies).toEqual([]);
    expect(
      await db.collection(names.links).findOne({ _id: abcId }),
    ).toMatchObject({
      key: "renamed",
      destination: "https://example.com/b",
      previousKeys: ["abc"],
    });
    expect(
      await db.collection(names.links).findOne({ urlCode: "fresh" }),
    ).toMatchObject({ key: "fresh" });
    expect(await db.collection(names.click_events).countDocuments()).toBe(4);

    const reversible = migrations.filter(
      (migration) => migration.id !== "0007-click-events-backfill",
    );
    const down = await runMigrations(client, db, reversible, {
      log: quiet,
      direction: "down",
      until: "0000",
      confirmDown: true,
    });
    for (const result of Object.values(down))
      expect(result.discrepancies).toEqual([]);
    const states = await db
      .collection<MigrationState>("_migrations")
      .find({ _id: { $ne: "lock" } })
      .toArray();
    for (const state of states)
      expect([state._id, state.status]).toEqual([
        state._id,
        state._id === "0007-click-events-backfill" ? "applied" : "reverted",
      ]);
    expect(
      await db.collection(names.links).countDocuments({
        $or: [
          { workspaceId: { $exists: true } },
          { domain: { $exists: true } },
          { tagIds: { $exists: true } },
          { utmVariants: { $exists: true } },
        ],
      }),
    ).toBe(0);
    expect(await db.collection(names.workspaces).countDocuments()).toBe(0);
    expect(await db.collection(names.usage_periods).countDocuments()).toBe(0);
    expect(
      await db
        .collection(names.tags)
        .countDocuments({ nameLower: { $exists: true } }),
    ).toBe(0);
    // Live events can't be told apart from backfilled ones once dual-writes
    // start, so 0007 has no automatic rollback.
    await expect(
      runMigrations(
        client,
        db,
        migrations.filter((migration) => migration.id.startsWith("0007")),
        { log: quiet, direction: "down", until: "0000", confirmDown: true },
      ),
    ).rejects.toThrow("No rollback for 0007");

    // An operator re-enables reverted continuous migrations by clearing them.
    await db
      .collection<MigrationState>("_migrations")
      .deleteMany({ status: "reverted" });
    const again = await runMigrations(client, db, migrations, { log: quiet });
    expect(Object.keys(again)).toHaveLength(migrations.length);
    for (const result of Object.values(again))
      expect(result.discrepancies).toEqual([]);
    expect(
      await db.collection(names.links).findOne({ _id: abcId }),
    ).toMatchObject({ key: "renamed", workspaceId: expect.any(ObjectId) });
  }, 60_000);
});
