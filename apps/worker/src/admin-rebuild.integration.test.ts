import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { physicalNames, collection, desiredIndexes, schemas } from "@shortn/db";
import {
  consoleMutation,
  createLink,
  createQr,
  updateQr,
  ensurePersonalWorkspace,
  type AdminContext,
} from "@shortn/core";
import { loadEntitlements } from "@shortn/billing";
import { computePlatformDay } from "./platform-metrics";
import { purgeAccount } from "./account-purge";
import { sendPlatformNotifications } from "./platform-notifications";
const mongo = process.env.MONGO_TEST_URL,
  redis = process.env.REDIS_TEST_URL;
(mongo && redis ? describe : describe.skip)("admin rebuild integration", () => {
  let client: MongoClient, db: Db, cache: Redis;
  const now = new Date("2026-10-22T12:00:00Z");
  const staff = new ObjectId();
  const ctx = (role: "admin" | "superadmin" = "superadmin"): AdminContext => ({
    db,
    cache,
    linkDomain: "shortn.at",
    admin: { id: String(staff), email: "staff@example.com", role },
    session: { id: "test", elevatedAt: now },
    request: {},
    now: () => now,
  });
  beforeAll(async () => {
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_admin_finish_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    cache = new Redis(redis!);
    for (const key of ["workspace_daily", "admin_audit_log", "user"] as const)
      await db
        .collection(physicalNames[key])
        .createIndexes(desiredIndexes[physicalNames[key]]!);
    await collection(db, "user").insertOne({
      _id: staff,
      email: "staff@example.com",
      role: "superadmin",
    });
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    cache?.disconnect();
  });
  test("direct action calls enforce role, step-up, reason, self and last-superadmin guards", async () => {
    const user = new ObjectId();
    await collection(db, "user").insertOne({
      _id: user,
      email: "member@example.com",
    });
    expect(
      await consoleMutation(
        ctx("admin"),
        "users",
        String(user),
        "role",
        { role: "admin" },
        "test",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    const stale = ctx();
    stale.session.elevatedAt = new Date(0);
    expect(
      await consoleMutation(stale, "users", String(user), "ban", {}, "test"),
    ).toEqual({ ok: false, error: "step_up_required" });
    expect(
      await consoleMutation(ctx(), "users", String(user), "ban", {}, ""),
    ).toEqual({ ok: false, error: "reason_required" });
    expect(
      await consoleMutation(
        ctx(),
        "users",
        String(staff),
        "role",
        { role: "user" },
        "test",
      ),
    ).toEqual({ ok: false, error: "self_action" });
    expect(
      (
        await consoleMutation(
          ctx(),
          "users",
          String(user),
          "ban",
          {},
          "Abuse report",
        )
      ).ok,
    ).toBe(true);
    expect((await collection(db, "user").findOne({ _id: user }))?.banned).toBe(
      true,
    );
    expect(
      (
        await collection(db, "admin_audit_log").findOne({
          targetId: String(user),
          action: "user.ban",
        })
      )?.status,
    ).toBe("succeeded");
  });
  test("rollups are idempotent, combine links and clicks, and preserve billing history", async () => {
    const workspace = new ObjectId();
    await db.collection(physicalNames.click_rollups).insertOne({
      linkId: new ObjectId(),
      workspaceId: workspace,
      day: new Date("2026-10-22"),
      clicks: 4,
      scans: 3,
    });
    const a = await computePlatformDay(db, new Date("2026-10-22"), now);
    const first = await collection(db, "workspace_daily").findOne({
      workspaceId: workspace,
    });
    const b = await computePlatformDay(db, new Date("2026-10-22"), now);
    const second = await collection(db, "workspace_daily").findOne({
      workspaceId: workspace,
    });
    expect(a).toEqual(b);
    expect(first).toEqual(second);
    expect(second?.clicks).toBe(4);
    expect(second?.scans).toBe(3);
  });
  test("scheduled deletion can be cancelled and refuses shared teams and bad confirmation", async () => {
    const user = new ObjectId();
    await collection(db, "user").insertOne({
      _id: user,
      email: "cancel@example.com",
    });
    expect(
      await consoleMutation(
        ctx(),
        "users",
        String(user),
        "delete",
        { confirm: "wrong" },
        "GDPR",
      ),
    ).toEqual({ ok: false, error: "confirmation_required" });
    expect(
      (
        await consoleMutation(
          ctx(),
          "users",
          String(user),
          "delete",
          { confirm: "cancel@example.com" },
          "GDPR",
        )
      ).ok,
    ).toBe(true);
    expect(
      (
        await collection(db, "user").findOne({ _id: user })
      )?.deletion?.purgeAfter.getTime(),
    ).toBe(now.getTime() + 7 * 86400000);
    expect(
      (
        await consoleMutation(
          ctx(),
          "users",
          String(user),
          "cancel-deletion",
          {},
          "Cancelled request",
        )
      ).ok,
    ).toBe(true);
    expect(
      (await collection(db, "user").findOne({ _id: user }))?.deletion,
    ).toBeUndefined();
  });
  test("entitlement grants validate scope, apply feature limits and restore the plan snapshot when cleared", async () => {
    const workspace = await ensurePersonalWorkspace(db, {
      id: String(new ObjectId()),
      name: "Comp fixture",
    });
    const expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
    expect(
      (
        await consoleMutation(
          ctx("admin"),
          "workspaces",
          String(workspace._id),
          "override",
          {
            plan: "pro",
            expiresAt,
            limits: JSON.stringify({ links: 50 }),
            planFeatures: JSON.stringify({
              add: ["api"],
              remove: ["passwords"],
            }),
          },
          "Support comp",
        )
      ).ok,
    ).toBe(true);
    const effective = await loadEntitlements(db, workspace._id, now);
    expect(effective.plan).toBe("pro");
    expect(effective.limits.links).toBe(50);
    expect(effective.features).not.toContain("passwords");
    expect(
      await consoleMutation(
        ctx("admin"),
        "workspaces",
        String(workspace._id),
        "override",
        { plan: "enterprise", expiresAt },
        "Extended comp",
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(
      (
        await consoleMutation(
          ctx(),
          "workspaces",
          String(workspace._id),
          "override",
          { clear: "yes" },
          "Comp ended",
        )
      ).ok,
    ).toBe(true);
    expect(
      (await collection(db, "workspaces").findOne({ _id: workspace._id }))
        ?.plan,
    ).toBe("free");
  });
  test("contact triage preserves the shared schema and records the staff decision", async () => {
    const id = new ObjectId();
    await db
      .collection(physicalNames.contacts)
      .insertOne({ _id: id, email: "contact@example.com" });
    expect(
      (
        await consoleMutation(
          ctx(),
          "contacts",
          String(id),
          "triage",
          { status: "replied", assignee: String(staff), note: "Followed up" },
          "Contact handled",
        )
      ).ok,
    ).toBe(true);
    const contact = await db
      .collection(physicalNames.contacts)
      .findOne({ _id: id });
    expect(
      schemas.contacts.shape.triage.safeParse(contact?.triage).success,
    ).toBe(true);
    expect(contact?.triage.updatedBy).toBe(String(staff));
  });
  test("QR backing destinations keep destination-host search keys current", async () => {
    const owner = new ObjectId();
    const workspace = await ensurePersonalWorkspace(db, {
      id: String(owner),
      name: "Host search QR",
    });
    const service = {
      db,
      cache,
      workspace,
      actor: { userId: String(owner), role: "owner" as const },
      linkDomain: "shortn.at",
    };
    const made = await createQr(service, {
      url: "https://one.example.com/path",
    });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const qr = await collection(db, "qr_codes").findOne({
      _id: new ObjectId(made.value.id),
    });
    expect(qr).not.toBeNull();
    const backingId = qr?.linkId;
    if (!backingId) throw new Error("Missing QR backing link");
    const backing = await collection(db, "links").findOne({ _id: backingId });
    expect(backing?.destHostRev).toBe("com.example.one");
    const updated = await updateQr(service, made.value.id, {
      url: "https://two.example.org/next",
    });
    expect(updated.ok).toBe(true);
    expect(
      (await collection(db, "links").findOne({ _id: backingId }))?.destHostRev,
    ).toBe("org.example.two");
  });
  test("shared team workspaces must be transferred before scheduling erasure", async () => {
    const userId = new ObjectId(),
      workspaceId = new ObjectId();
    await collection(db, "user").insertOne({
      _id: userId,
      email: "shared-owner@example.com",
    });
    await db.collection(physicalNames.workspaces).insertOne({
      _id: workspaceId,
      ownerUserId: String(userId),
      personal: false,
      name: "Shared team",
      slug: `shared-${userId}`,
    });
    await db.collection(physicalNames.workspace_members).insertOne({
      workspaceId,
      userId: String(new ObjectId()),
      role: "member",
    });
    expect(
      await consoleMutation(
        ctx(),
        "users",
        String(userId),
        "delete",
        { confirm: "shared-owner@example.com" },
        "Erasure",
      ),
    ).toEqual({ ok: false, error: "transfer_shared_workspaces_first" });
    expect(
      (await collection(db, "user").findOne({ _id: userId }))?.deletion,
    ).toBeUndefined();
  });
  test("purge dry run is read only; purge removes owned data and mixed-id credentials but retains evidence", async () => {
    const userId = new ObjectId();
    const userIdString = String(userId);
    await collection(db, "user").insertOne({
      _id: userId,
      email: "erase@example.com",
      sub: "erase-sub",
    });
    const workspace = await ensurePersonalWorkspace(db, {
      id: userIdString,
      name: "Erasure",
    });
    const wid = workspace._id;
    workspace.legacySub = "erase-sub";
    await collection(db, "workspaces").updateOne(
      { _id: wid },
      { $set: { legacySub: "erase-sub" } },
    );
    const link = await createLink(
      {
        db,
        cache,
        workspace,
        actor: { userId: userIdString, role: "owner" },
        linkDomain: "shortn.at",
      },
      { url: "https://example.com/erase-me" },
    );
    expect(link.ok).toBe(true);
    const pageId = new ObjectId();
    await db.collection(physicalNames.bio_pages).insertOne({
      _id: pageId,
      workspaceId: wid,
      userId: "erase-sub",
      handle: `purge-${userId}`,
      links: [],
      logo: `https://app.shortn.at/api/assets/uploads/workspaces/${wid}/logo.png`,
    });
    await db
      .collection(physicalNames.bio_aliases)
      .insertOne({ slug: `old-purge-${userId}`, bioPageId: pageId });
    await db.collection(physicalNames.bio_page_versions).insertOne({
      workspaceId: wid,
      bioPageId: pageId,
      content: { name: "Erased content" },
    });
    await db.collection(physicalNames.domains).insertOne({
      workspaceId: wid,
      hostname: `purge-${userId}.example.com`,
      status: "disabled",
      removing: true,
    });
    const jobId = new ObjectId();
    await db.collection(physicalNames.qr_zip_jobs).insertOne({
      _id: jobId,
      workspaceId: wid,
      state: "completed",
      objectKey: `exports/qr/${wid}/bundle.zip`,
    });
    await db.collection(physicalNames.qr_zip_items).insertOne({
      jobId,
      objectKey: `exports/qr/${wid}/item.svg`,
      design: { name: "Private design" },
    });
    await db.collection(physicalNames.contacts).insertOne({
      email: "erase@example.com",
      message: "Retained support evidence",
    });
    await db
      .collection("clicks_deleted")
      .insertOne({ sub: "erase-sub", ip: "192.0.2.2" });
    await db
      .collection(physicalNames.click_ips)
      .insertOne({ sid: `erase-${userId}`, ip: "192.0.2.1" });

    for (const name of [
      physicalNames.tags,
      physicalNames.campaigns,
      physicalNames.api_keys,
      physicalNames.import_rows,
      physicalNames.import_receipts,
      physicalNames.usage_periods,
      physicalNames.workspace_daily,
    ])
      await db
        .collection(name)
        .insertOne({ workspaceId: wid, createdBy: userIdString });
    for (const name of [
      physicalNames.session,
      physicalNames.account,
      physicalNames.passkeys,
      physicalNames.two_factor,
      physicalNames.oauth_consents,
      physicalNames.oauth_access_tokens,
      physicalNames.sso_bindings,
    ]) {
      await db.collection(name).insertOne({ userId: userIdString });
      await db.collection(name).insertOne({ userId });
    }
    await db
      .collection(physicalNames.click_events)
      .insertOne({ m: { workspaceId: wid }, sid: `erase-${userId}` });
    const reportId = new ObjectId();
    await db
      .collection(physicalNames.link_reports)
      .insertOne({ _id: reportId, status: "open", linkId: new ObjectId() });
    await consoleMutation(
      ctx(),
      "users",
      userIdString,
      "delete",
      { confirm: "erase@example.com" },
      "GDPR erasure",
    );
    const future = new Date(now.getTime() + 8 * 86400000);
    const removed: string[] = [];
    const deps = {
      db,
      cache,
      linkDomain: "shortn.at",
      now: () => future,
      store: {
        delete: async (key: string) => {
          removed.push(key);
        },
        deletePrefix: async (key: string) => {
          removed.push(key);
        },
        head: async () => null,
        get: async () => new Uint8Array(),
        put: async () => {},
        sign: async () => "",
      },
    };
    expect(await purgeAccount(deps, { dryRun: true })).not.toBeNull();
    expect(
      await collection(db, "workspaces").countDocuments({ _id: wid }),
    ).toBe(1);
    await expect(purgeAccount(deps)).rejects.toThrow(
      "waiting_for_domain_removal",
    );
    await db
      .collection(physicalNames.domains)
      .updateMany({ workspaceId: wid }, { $set: { removing: false } });
    await db
      .collection(physicalNames.user)
      .updateOne(
        { _id: userId },
        { $set: { "deletion.leaseUntil": new Date(0) } },
      );
    await expect(purgeAccount(deps)).rejects.toThrow(
      "waiting_for_bio_invalidation",
    );
    await db
      .collection(physicalNames.bio_delivery_jobs)
      .deleteMany({ bioPageId: pageId });
    await db
      .collection(physicalNames.user)
      .updateOne(
        { _id: userId },
        { $set: { "deletion.leaseUntil": new Date(0) } },
      );
    expect(await purgeAccount(deps)).toMatchObject({ purged: userIdString });
    expect(removed).toContain(`exports/qr/${wid}/bundle.zip`);
    expect(removed).toContain(`exports/qr/${wid}/item.svg`);
    expect(removed).toContain(`uploads/workspaces/${wid}`);
    expect(
      await db
        .collection(physicalNames.click_ips)
        .countDocuments({ sid: `erase-${userId}` }),
    ).toBe(0);
    expect(
      await db
        .collection("clicks_deleted")
        .countDocuments({ sub: "erase-sub" }),
    ).toBe(0);
    expect(
      await db
        .collection(physicalNames.bio_aliases)
        .countDocuments({ bioPageId: pageId }),
    ).toBe(0);
    expect(
      await db
        .collection(physicalNames.bio_page_versions)
        .countDocuments({ bioPageId: pageId }),
    ).toBe(0);
    expect(
      await db.collection(physicalNames.qr_zip_items).countDocuments({ jobId }),
    ).toBe(0);
    expect(
      (
        await db
          .collection(physicalNames.contacts)
          .findOne({ email: "erase@example.com" })
      )?.gdprRetainUntil,
    ).toBeInstanceOf(Date);
    const tombstone = await db
      .collection(physicalNames.user)
      .findOne({ _id: userId });
    expect(tombstone?.email).toBeUndefined();
    expect(tombstone?.emailHash).toHaveLength(64);
    expect(tombstone?.deletion.state).toBe("done");
    expect(
      await collection(db, "workspaces").countDocuments({ _id: wid }),
    ).toBe(0);
    expect(
      await db
        .collection(physicalNames.click_events)
        .countDocuments({ "m.workspaceId": wid }),
    ).toBe(0);
    expect(
      await db
        .collection(physicalNames.account)
        .countDocuments({ userId: { $in: [userId, userIdString] } }),
    ).toBe(0);
    expect(
      await collection(db, "link_reports").countDocuments({ _id: reportId }),
    ).toBe(1);
  });
  test("notification drain retries safely and removes delivery addresses after sending", async () => {
    const sent: string[] = [];
    const mailer = {
      platformNotice: async (input: { idempotencyKey: string }) => {
        sent.push(input.idempotencyKey);
      },
    };
    await sendPlatformNotifications(db, mailer, now);
    await sendPlatformNotifications(db, mailer, now);
    expect(new Set(sent).size).toBe(sent.length);
    expect(sent.length).toBeGreaterThan(0);
    expect(
      await db
        .collection(physicalNames.platform_notifications)
        .countDocuments({ sentAt: { $exists: true }, to: { $exists: true } }),
    ).toBe(0);
  });
});
