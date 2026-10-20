import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { physicalNames } from "../../packages/db";
import { legacyWorkspaceSuspended } from "../lib/workspace-suspension";

const mongo = process.env.MONGO_TEST_URL;
(mongo ? describe : describe.skip)("legacy fallback suspension read", () => {
  const dbName = `shortn_legacy_suspension_${crypto.randomUUID().replaceAll("-", "")}`;
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost"].includes(new URL(mongo!).hostname))
      throw new Error("Loopback Mongo required");
    await mongoose.connect(mongo!, { dbName, autoIndex: false });
  });
  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  });

  test("only a suspended workspace blocks its links on the fallback path", async () => {
    const workspaces = mongoose.connection.collection(physicalNames.workspaces);
    const [suspended, locked, active] = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
    ];
    await workspaces.insertMany([
      { _id: suspended, suspension: { level: "suspended" } },
      { _id: locked, suspension: { level: "locked" } },
      { _id: active },
    ]);
    expect(await legacyWorkspaceSuspended(suspended)).toBe(true);
    expect(await legacyWorkspaceSuspended(locked)).toBe(false);
    expect(await legacyWorkspaceSuspended(active)).toBe(false);
    expect(await legacyWorkspaceSuspended(undefined)).toBe(false);
    expect(await legacyWorkspaceSuspended(String(suspended))).toBe(false);
  });
});
