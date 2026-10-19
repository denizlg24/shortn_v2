import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { Redis } from "ioredis";
import { desiredIndexes, physicalNames } from "@shortn/db";
import { listLinks } from "./service";
import { linkExportFilterSchema } from "../exports/links";
import { ensurePersonalWorkspace } from "../workspaces/service";
import type { ServiceContext } from "../workspaces/context";

const mongo = process.env.MONGO_TEST_URL,
  cache = process.env.REDIS_TEST_URL;
(mongo && cache ? describe : describe.skip)(
  "domain, campaign, untagged and all-of tag filters",
  () => {
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
        `shortn_link_filters_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      redis = new Redis(cache!);
      await db
        .collection(physicalNames.links)
        .createIndexes(desiredIndexes[physicalNames.links]!);
    });
    afterAll(async () => {
      await db?.dropDatabase();
      await client?.close();
      redis?.disconnect();
    });

    async function library() {
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Synthetic filters",
      });
      const ctx: ServiceContext = {
        db,
        cache: redis,
        workspace,
        actor: { userId, role: "owner" },
        linkDomain: "shortn.at",
      };
      const link = (
        key: string,
        extra: Record<string, unknown> = {},
        minutes = 0,
      ) => ({
        _id: new ObjectId(),
        workspaceId: workspace._id,
        urlCode: `${workspace._id.toHexString()}-${key}`,
        longUrl: `https://example.com/${key}`,
        title: key,
        date: new Date(Date.UTC(2026, 9, 1, 0, minutes)),
        ...extra,
      });
      const rows = {
        legacy: link("legacy", { tags: [{ tagName: "Print" }] }, 1),
        platform: link(
          "platform",
          {
            domain: "shortn.at",
            tags: [{ tagName: "Print" }, { tagName: "Promo" }],
          },
          2,
        ),
        custom: link(
          "custom",
          { domain: "go.example.com", tags: [{ tagName: "Promo" }] },
          3,
        ),
        empty: link("empty", { tags: [] }, 4),
        blank: link("blank", { tags: [{ tagName: "  " }] }, 5),
        missing: link("missing", {}, 6),
      };
      await db.collection(physicalNames.links).insertMany(Object.values(rows));
      const keys = async (input: Parameters<typeof listLinks>[1]) =>
        (await listLinks(ctx, { ...input, page: 1, limit: 50 })).links
          .map((row) => row.title)
          .sort();
      return { ctx, rows, keys, workspace };
    }

    test("domain matches custom hostnames exactly and the default domain includes legacy links", async () => {
      const { keys } = await library();
      expect(await keys({ domain: "go.example.com" })).toEqual(["custom"]);
      expect(await keys({ domain: "GO.EXAMPLE.COM" })).toEqual(["custom"]);
      expect(await keys({ domain: "shortn.at" })).toEqual([
        "blank",
        "empty",
        "legacy",
        "missing",
        "platform",
      ]);
      expect(await keys({ domain: "other.example" })).toEqual([]);
    });

    test("untagged covers missing, empty and nameless tag arrays and joins any-of tags", async () => {
      const { keys } = await library();
      expect(await keys({ untagged: true })).toEqual([
        "blank",
        "empty",
        "missing",
      ]);
      expect(await keys({ tags: ["Promo"], untagged: true })).toEqual([
        "blank",
        "custom",
        "empty",
        "missing",
        "platform",
      ]);
    });

    test("all-of requires every tag; any-of keeps the existing union", async () => {
      const { keys } = await library();
      expect(await keys({ tags: ["Print", "Promo"] })).toEqual([
        "custom",
        "legacy",
        "platform",
      ]);
      expect(await keys({ tags: ["Print", "Promo"], tagMode: "all" })).toEqual([
        "platform",
      ]);
      expect(
        await keys({
          tags: ["Print", "Promo"],
          tagMode: "all",
          untagged: true,
        }),
      ).toEqual(["platform"]);
    });

    test("campaign scope intersects with the other filters and rejects foreign campaigns", async () => {
      const { ctx, rows, keys, workspace } = await library();
      const campaign = new ObjectId();
      await db.collection(physicalNames.campaigns).insertOne({
        _id: campaign,
        workspaceId: workspace._id,
        title: "Spring",
        links: [rows.platform._id, rows.custom._id],
      });
      expect(await keys({ campaign: campaign.toHexString() })).toEqual([
        "custom",
        "platform",
      ]);
      expect(
        await keys({ campaign: campaign.toHexString(), domain: "shortn.at" }),
      ).toEqual(["platform"]);
      const foreign = new ObjectId();
      await db.collection(physicalNames.campaigns).insertOne({
        _id: foreign,
        workspaceId: new ObjectId(),
        title: "Elsewhere",
        links: [rows.platform._id],
      });
      expect(
        (await listLinks(ctx, { campaign: foreign.toHexString(), page: 1 }))
          .total,
      ).toBe(0);
    });

    test("exports accept the same bounded filters", () => {
      expect(
        linkExportFilterSchema.parse({
          domain: "go.example.com",
          untagged: true,
          tagMode: "all",
          tags: ["Print"],
        }),
      ).toEqual({
        domain: "go.example.com",
        untagged: true,
        tagMode: "all",
        tags: ["Print"],
      });
      for (const domain of ["GO.EXAMPLE.COM", "a b", "x".repeat(254)])
        expect(linkExportFilterSchema.safeParse({ domain }).success).toBe(
          false,
        );
      expect(
        linkExportFilterSchema.safeParse({ tagMode: "some" }).success,
      ).toBe(false);
    });
  },
);
