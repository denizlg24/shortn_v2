import { expect, test } from "bun:test";
import { ObjectId } from "mongodb";
import { desiredIndexes, equivalentIndex, legacyCollections } from "./indexes";
import { physicalNames } from "./collections";
import {
  bioPageSchema,
  clickEventSchema,
  linkSchema,
  qrCodeSchema,
  workspaceSchema,
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
  expect(physicalNames.links).toBe("urlv3");
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

test("physical names include all audited legacy names and accept validated JSON overrides", async () => {
  const { resolvePhysicalNames } = await import("./collections");
  expect(resolvePhysicalNames().links).toBe("urlv3");
  expect(resolvePhysicalNames().link_reports).toBe("linkreports");
  expect(resolvePhysicalNames().scheduled_changes).toBe("scheduledchanges");
  expect(resolvePhysicalNames().login_records).toBe("loginrecords");
  expect(resolvePhysicalNames('{"links":"audited_links"}').links).toBe(
    "audited_links",
  );
  expect(() => resolvePhysicalNames('{"typo":"x"}')).toThrow("Unknown");
  expect(() => resolvePhysicalNames('{"constructor":"x"}')).toThrow("Unknown");
  expect(() => resolvePhysicalNames('{"links":"tags"}')).toThrow("distinct");
  expect(() => resolvePhysicalNames('{"links":"a.b"}')).toThrow();
});

test("rollback requires a confirmed explicit target and selects only newer ids in reverse order", () => {
  const migrations = [
    exampleMigration,
    { ...exampleMigration, id: "0002-next" },
    { ...exampleMigration, id: "0003-last" },
  ];
  expect(() => validateOptions(migrations, { direction: "down" })).toThrow(
    "--confirm-down",
  );
  expect(() =>
    validateOptions(migrations, {
      direction: "down",
      until: exampleMigration.id,
    }),
  ).toThrow("--confirm-down");
  expect(
    validateOptions(migrations, {
      direction: "down",
      until: exampleMigration.id,
      confirmDown: true,
    }).map((m) => m.id),
  ).toEqual(["0003-last", "0002-next"]);
});

test("URL fields reject executable schemes and allow http(s)", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.com/file",
  ]) {
    for (const fields of [
      { destination: url },
      { longUrl: url },
      { og: { image: url } },
      { rules: { geo: [{ countries: ["DK"], destination: url }] } },
      { rules: { devices: [{ device: "mobile", destination: url }] } },
      { rules: { rotation: [{ destination: url, weight: 1 }] } },
      { rules: { deepLinks: { ios: url } } },
      { utmLinks: [{ url }] },
    ])
      expect(
        linkSchema.safeParse({ _id: new ObjectId(), ...fields }).success,
      ).toBe(false);
    for (const fields of [
      { avatar: url },
      { seo: { image: url } },
      { socials: [{ url }] },
      { blocks: [{ type: "image", url, alt: "a" }] },
      { blocks: [{ type: "socials", items: [{ platform: "web", url }] }] },
      { blocks: [{ type: "profile", avatar: url }] },
      { blocks: [{ type: "link", linkId: new ObjectId(), image: url }] },
    ])
      expect(
        bioPageSchema.safeParse({ _id: new ObjectId(), ...fields }).success,
      ).toBe(false);
    expect(
      qrCodeSchema.safeParse({ _id: new ObjectId(), design: { data: url } })
        .success,
    ).toBe(false);
    expect(
      qrCodeSchema.safeParse({ _id: new ObjectId(), options: { data: url } })
        .success,
    ).toBe(false);
    expect(workspaceSchema.shape.logo.safeParse(url).success).toBe(false);
  }
  for (const destination of ["http://example.com", "https://example.com"])
    expect(
      linkSchema.safeParse({ _id: new ObjectId(), destination }).success,
    ).toBe(true);
});

test("both CLI target guards show hosts/db without credentials and require --yes remotely", async () => {
  const { confirmMongoTarget } = await import("./cli-target");
  const logs: string[] = [];
  expect(() =>
    confirmMongoTarget(
      "mongodb://u:password@remote.example/db",
      "explicit",
      [],
      (message) => logs.push(message),
    ),
  ).toThrow("--yes");
  expect(logs.join()).toContain("remote.example");
  expect(logs.join()).toContain("explicit");
  expect(logs.join()).not.toContain("password");
  expect(() =>
    confirmMongoTarget("mongodb://remote.example/", "db", ["--yes"], () => {}),
  ).not.toThrow();
  for (const host of ["localhost", "127.0.0.1", "[::1]"])
    expect(() =>
      confirmMongoTarget(`mongodb://${host}:27017/`, "db", [], () => {}),
    ).not.toThrow();
  expect(() =>
    confirmMongoTarget(
      "mongodb://127.0.0.1:27017,remote.example:27017/",
      "db",
      [],
      () => {},
    ),
  ).toThrow("--yes");
});

test("environment collection overrides reach every index definition", async () => {
  const { defaultPhysicalNames } = await import("./collections");
  const overrides = Object.fromEntries(
    Object.keys(defaultPhysicalNames).map((key) => [key, `audited_${key}`]),
  );
  const child = Bun.spawn(
    [
      "bun",
      "-e",
      'import {desiredIndexes} from "./indexes"; console.log(JSON.stringify(Object.keys(desiredIndexes)))',
    ],
    {
      cwd: import.meta.dir,
      env: {
        ...process.env,
        MONGODB_PHYSICAL_NAMES: JSON.stringify(overrides),
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(stderr).toBe("");
  expect(exit).toBe(0);
  const names: string[] = JSON.parse(stdout);
  expect(names).toHaveLength(Object.keys(desiredIndexes).length);
  for (const name of names) expect(name.startsWith("audited_")).toBe(true);
});

test("required Mongo integration fails instead of silently skipping fixtures", async () => {
  for (const file of ["integration.test.ts", "safety.integration.test.ts"]) {
    const child = Bun.spawn(["bun", "test", file], {
      cwd: import.meta.dir,
      env: { ...process.env, REQUIRE_INTEGRATION: "1", MONGO_TEST_URL: "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [exit, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ]);
    expect(exit).not.toBe(0);
    expect(stderr).toContain("MONGO_TEST_URL required");
  }
});
