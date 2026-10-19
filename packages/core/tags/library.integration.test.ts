import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import {
  createTag,
  getTag,
  mergeTag,
  pageTags,
  setTagColor,
  tagColorsByName,
  tagLinkCounts,
  tagUsage,
  untaggedLinkCount,
} from "./service";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";
import type { Role } from "../workspaces/authz";

const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)("tag library", () => {
  let client: MongoClient, db: Db, redis: Redis;
  beforeAll(async () => {
    if (
      ![mongo, cache].every((url) =>
        ["localhost", "127.0.0.1"].includes(new URL(url!).hostname),
      )
    )
      throw new Error("Loopback services required");
    client = await new MongoClient(mongo!).connect();
    db = client.db(
      `shortn_tag_library_${crypto.randomUUID().replaceAll("-", "")}`,
    );
    redis = new Redis(cache!);
    for (const name of [
      physicalNames.links,
      physicalNames.tags,
      physicalNames.qr_codes,
      physicalNames.webhook_events,
    ])
      await db.collection(name).createIndexes(desiredIndexes[name]!);
  });
  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
    redis?.disconnect();
  });

  async function workspaceFixture() {
    const owner = new ObjectId().toHexString();
    const workspace = await ensurePersonalWorkspace(db, {
      id: owner,
      name: "Synthetic library",
      sub: `library|${owner}`,
    });
    const as = (role: Role, userId = owner): ServiceContext => ({
      db,
      cache: redis,
      workspace,
      actor: { userId, role },
      linkDomain: "shortn.at",
    });
    const tag = async (name: string) => {
      const result = await createTag(as("owner"), name);
      if (!result.ok) throw new Error(result.error);
      return result.value;
    };
    const link = async (
      names: { id: string; name: string }[],
      extra: Record<string, unknown> = {},
    ) => {
      const _id = new ObjectId();
      await db.collection(physicalNames.links).insertOne({
        _id,
        workspaceId: workspace._id,
        urlCode: `${workspace._id.toHexString()}-${_id.toHexString()}`,
        longUrl: "https://example.com/",
        date: new Date(),
        tags: names.map((item) => ({
          _id: new ObjectId(item.id),
          tagName: item.name,
        })),
        tagIds: names.map((item) => new ObjectId(item.id)),
        ...extra,
      });
      return _id;
    };
    return { workspace, as, tag, link };
  }

  test("pages by display name with search, view-scoped counts and an untagged count", async () => {
    const { as, tag, link } = await workspaceFixture();
    const [alpha, beta, gamma] = [
      await tag("beta"),
      await tag("Alpha"),
      await tag("Gamma"),
    ].sort((a, b) => a.name.localeCompare(b.name));
    await link([alpha!, beta!]);
    await link([alpha!]);
    await link([alpha!], { archivedAt: new Date() });
    await link([beta!], { deletedAt: new Date() });
    await link([]);
    const ctx = as("viewer");
    const first = await pageTags(ctx, { limit: 2 });
    expect([first.total, first.pages, first.page]).toEqual([3, 2, 1]);
    expect(first.items.map((item) => [item.name, item.links])).toEqual([
      ["Alpha", 2],
      ["beta", 1],
    ]);
    const second = await pageTags(ctx, { limit: 2, page: 9 });
    expect([second.page, second.items.map((item) => item.name)]).toEqual([
      2,
      ["Gamma"],
    ]);
    expect(
      (await pageTags(ctx, { counts: { archived: true } })).items.map(
        (item) => item.links,
      ),
    ).toEqual([1, 0, 0]);
    expect(
      (await pageTags(ctx, { counts: { trash: true } })).items.map(
        (item) => item.links,
      ),
    ).toEqual([0, 1, 0]);
    expect(
      (await pageTags(ctx, { search: "AMM", counts: false })).items,
    ).toMatchObject([{ name: gamma!.name, links: null }]);
    expect(
      (await pageTags(ctx, { sort: "newest" })).items.map((item) => item.name),
    ).toEqual(["Gamma", "Alpha", "beta"]);
    expect(await untaggedLinkCount(ctx)).toBe(1);
  });

  test("counts each link once even when a legacy copy embeds the tag twice", async () => {
    const { as, tag, link } = await workspaceFixture();
    const print = await tag("Print");
    const id = await link([print]);
    await db.collection(physicalNames.links).updateOne({ _id: id }, [
      {
        $set: {
          tags: {
            $concatArrays: ["$tags", [{ tagName: "Print", id: "legacy" }]],
          },
        },
      },
    ]);
    expect((await tagLinkCounts(as("owner"), ["Print"])).get("Print")).toBe(1);
  });

  test("colour changes are validated, role-gated and readable by name", async () => {
    const { as, tag } = await workspaceFixture();
    const print = await tag("Print");
    expect(await setTagColor(as("viewer"), print.id, "teal")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await setTagColor(as("member"), print.id, "#ff0000")).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(
      await setTagColor(as("member"), new ObjectId().toHexString(), "teal"),
    ).toEqual({ ok: false, error: "not_found" });
    const changed = await setTagColor(as("member"), print.id, "teal");
    expect(changed.ok && changed.value.color).toBe("teal");
    expect(await tagColorsByName(as("viewer"), ["PRINT", "Unknown"])).toEqual({
      print: "teal",
    });
  });

  test("merge moves links and QR codes onto the target without duplicates and keeps legacy IDs", async () => {
    const { workspace, as, tag, link } = await workspaceFixture();
    const source = await tag("Flyer");
    const target = await tag("Print");
    const other = await tag("Promo");
    const onlySource = await link([source, other]);
    const both = await link([source, target]);
    const trashed = await link([source], { deletedAt: new Date() });
    const untouched = await link([other]);
    const qr = new ObjectId();
    await db.collection(physicalNames.qr_codes).insertOne({
      _id: qr,
      workspaceId: workspace._id,
      tags: [{ id: source.legacyId, tagName: "Flyer" }],
    });
    expect(await tagUsage(as("viewer"), source.id)).toEqual({
      links: 3,
      qrCodes: 1,
    });
    expect(await mergeTag(as("viewer"), source.id, target.id)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(
      await mergeTag(
        as("member", new ObjectId().toHexString()),
        source.id,
        target.id,
      ),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(await mergeTag(as("owner"), source.id, source.id)).toEqual({
      ok: false,
      error: "invalid_input",
    });
    const merged = await mergeTag(as("owner"), source.id, target.id);
    expect(merged.ok && merged.value.name).toBe("Print");
    const read = async (id: ObjectId) => {
      const doc = await db.collection(physicalNames.links).findOne({ _id: id });
      return {
        names: (doc?.tags ?? []).map(
          (item: { tagName: string }) => item.tagName,
        ),
        ids: (doc?.tagIds ?? []).map(String),
      };
    };
    expect(await read(onlySource)).toEqual({
      names: ["Promo", "Print"],
      ids: [other.id, target.id],
    });
    expect(await read(both)).toEqual({
      names: ["Print"],
      ids: [target.id],
    });
    expect((await read(trashed)).names).toEqual(["Print"]);
    expect((await read(untouched)).names).toEqual(["Promo"]);
    const code = await db
      .collection(physicalNames.qr_codes)
      .findOne({ _id: qr });
    expect(code?.tags.map((item: { tagName: string }) => item.tagName)).toEqual(
      ["Print"],
    );
    expect(await getTag(as("viewer"), source.id)).toBeNull();
    expect((await getTag(as("viewer"), source.legacyId!))?.id).toBe(target.id);
    expect(await tagUsage(as("viewer"), target.id)).toEqual({
      links: 3,
      qrCodes: 1,
    });
  });
});
