import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames } from "./collections";
import { workspaces } from "./migrations/m0002-workspaces";
import { orphanWorkspaceSlug } from "./migrations/helpers";
import type { MigrationContext } from "./migrations/runner";
const url = process.env.MONGO_TEST_URL;
(url ? describe : describe.skip)(
  "workspace migration verification with native records",
  () => {
    let client: MongoClient;
    const databases: Db[] = [];
    beforeAll(async () => {
      if (!["localhost", "127.0.0.1"].includes(new URL(url!).hostname))
        throw Error("Loopback only");
      client = await new MongoClient(url!).connect();
    });
    afterAll(async () => {
      for (const db of databases) await db.dropDatabase();
      await client?.close();
    });
    async function fixture() {
      const db = client.db(
        `shortn_workspace_verify_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      databases.push(db);
      const legacyUser = new ObjectId(),
        nativeUser = new ObjectId(),
        personal = new ObjectId(),
        nativePersonal = new ObjectId(),
        team = new ObjectId(),
        orphan = new ObjectId();
      await db
        .collection(physicalNames.user)
        .insertMany([
          { _id: legacyUser, sub: "legacy|owner" },
          { _id: nativeUser },
        ]);
      await db.collection(physicalNames.workspaces).insertMany([
        {
          _id: personal,
          ownerUserId: String(legacyUser),
          personal: true,
          legacySub: "legacy|owner",
          slug: "legacy",
        },
        {
          _id: nativePersonal,
          ownerUserId: String(nativeUser),
          personal: true,
          slug: "native",
        },
        {
          _id: team,
          ownerUserId: String(nativeUser),
          personal: false,
          slug: "team",
        },
        {
          _id: orphan,
          ownerUserId: "system",
          personal: false,
          slug: orphanWorkspaceSlug,
        },
      ]);
      for (const [key, field] of [
        ["links", "sub"],
        ["qr_codes", "sub"],
        ["campaigns", "sub"],
        ["tags", "sub"],
        ["bio_pages", "userId"],
      ] as const) {
        await db
          .collection(physicalNames[key])
          .insertMany([
            { workspaceId: team, createdBy: String(nativeUser) },
            { workspaceId: nativePersonal, createdBy: String(nativeUser) },
            { workspaceId: personal, [field]: "legacy|owner" },
            { workspaceId: orphan, [field]: "legacy|missing" },
            { workspaceId: orphan },
          ]);
      }
      const ctx = {
        direction: "up",
        read: (name: string) => db.collection(name),
        exists: async (name: string) =>
          !!(await db.listCollections({ name }).toArray()).length,
      } as unknown as MigrationContext;
      return { db, ctx, team, orphan };
    }
    test("accepts native team/personal data while preserving actual legacy orphan counts", async () => {
      const { ctx } = await fixture();
      const result = await workspaces.verify(ctx);
      expect(result.ok).toBe(true);
      expect(result.counts.expectedOrphans).toBe(10);
      expect(result.counts.orphanWorkspaceDocs).toBe(10);
    });
    test("a missing canonical workspace still fails verification", async () => {
      const { db, ctx } = await fixture();
      await db
        .collection(physicalNames.links)
        .insertOne({ workspaceId: new ObjectId() });
      expect((await workspaces.verify(ctx)).ok).toBe(false);
    });
    test("a known legacy owner assigned to a team still fails verification", async () => {
      const { db, ctx, team } = await fixture();
      await db
        .collection(physicalNames.links)
        .updateOne({ sub: "legacy|owner" }, { $set: { workspaceId: team } });
      expect((await workspaces.verify(ctx)).ok).toBe(false);
    });
    test("an unknown legacy owner assigned outside the orphan workspace still fails", async () => {
      const { db, ctx, team } = await fixture();
      await db
        .collection(physicalNames.links)
        .updateOne({ sub: "legacy|missing" }, { $set: { workspaceId: team } });
      expect((await workspaces.verify(ctx)).ok).toBe(false);
    });
  },
);
