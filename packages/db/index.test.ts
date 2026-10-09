import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { desiredIndexes, equivalentIndex, legacyCollections } from "./indexes";
import { physicalNames } from "./collections";
import {
  bioPageSchema,
  clickEventSchema,
  linkSchema,
  qrCodeSchema,
  tagSchema,
} from "./schemas";
import { exampleMigration } from "./migrations/example.fixture";
import { assertReadPipeline, validateOptions } from "./migrations/runner";
test("expand schemas accept unmigrated legacy documents and preserve extra legacy data", () => {
  const _id = new ObjectId();
  expect(
    linkSchema.parse({
      _id,
      urlCode: "abc",
      longUrl: "https://example.com",
      clicks: { total: 0, lastClick: null },
      customCode: true,
    }).customCode,
  ).toBe(true);
  expect(
    qrCodeSchema.safeParse({
      _id,
      qrCodeId: "q",
      urlId: "abc",
      options: { data: "https://shortn.at/abc" },
      clicks: { total: 0, lastClick: null },
    }).success,
  ).toBe(true);
  expect(
    tagSchema.safeParse({ _id, id: "t", tagName: "legacy", sub: "u" }).success,
  ).toBe(true);
  expect(
    bioPageSchema.safeParse({
      _id,
      slug: "old_slug",
      userId: "legacy-sub",
      links: [],
      theme: { font: "Inter" },
    }).success,
  ).toBe(true);
  expect(physicalNames.links).toBe("urlv3s");
});
test("supplied new fields still validate; click orphan metadata remains attachable", () => {
  expect(
    linkSchema.safeParse({ _id: new ObjectId(), workspaceId: "bad" }).success,
  ).toBe(false);
  expect(
    clickEventSchema.safeParse({
      ts: new Date(),
      m: {
        workspaceId: new ObjectId(),
        linkId: null,
        kind: "click",
        domain: "shortn.at",
        key: "orphan",
      },
      bot: false,
      ipHash: "h",
      ipPrefix: "prefix",
      uaHash: "h",
    }).success,
  ).toBe(true);
});
test("every new unique legacy-written index is partial", () => {
  for (const name of legacyCollections)
    for (const index of desiredIndexes[name] ?? [])
      if (index.unique) expect(index.partialFilterExpression).toBeDefined();
});
test("index comparison includes nested partial filter and ordered compound keys", () => {
  const desired = {
    key: { domain: 1, key: 1 },
    unique: true,
    partialFilterExpression: { key: { $type: "string" } },
  };
  expect(
    equivalentIndex(desired, { ...desired, name: "different-name", v: 2 }),
  ).toBe(true);
  expect(
    equivalentIndex(desired, {
      ...desired,
      name: "test",
      partialFilterExpression: { key: { $exists: true } },
    }),
  ).toBe(false);
  expect(
    equivalentIndex(desired, {
      ...desired,
      key: { key: 1, domain: 1 },
      name: "test",
    }),
  ).toBe(false);
});
test("runner validates contract authorization, until, duplicate ids and batch bounds", () => {
  const contract = { ...exampleMigration, phase: "contract" as const };
  expect(() => validateOptions([contract], {})).toThrow("--confirm-contract");
  expect(validateOptions([contract], { verifyOnly: true })).toHaveLength(1);
  expect(validateOptions([contract], { confirmContract: true })).toHaveLength(
    1,
  );
  expect(() =>
    validateOptions([exampleMigration], { until: "missing" }),
  ).toThrow("Unknown --until");
  expect(() =>
    validateOptions([exampleMigration, exampleMigration], {}),
  ).toThrow("duplicate");
  expect(() => validateOptions([], { batchSize: 5001 })).toThrow("batchSize");
});

test("read pipelines reject writes including nested stages", () => {
  expect(() => assertReadPipeline([{ $out: "bad" }])).toThrow("cannot use");
  expect(() =>
    assertReadPipeline([{ $facet: { nested: [{ $merge: "bad" }] } }]),
  ).toThrow("cannot use");
  expect(() =>
    assertReadPipeline([{ $match: { expanded: true } }]),
  ).not.toThrow();
});
