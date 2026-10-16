/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import {
  createLink,
  linkExportJobs,
  parseImportCsv,
  mapImportRecord,
  detectImportMapping,
  type ServiceContext,
} from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createLinkExportWorker } from "../../worker/src/link-exports";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const cache = new Redis("redis://127.0.0.1:16380/6"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const workspace = (await collection(db, "workspaces").findOne({
  _id: new ObjectId(login.workspaceId),
}))!;
const ctx: ServiceContext = {
  db,
  cache,
  workspace,
  actor: { userId: login.userId, role: "owner" },
  linkDomain: "shortn.invalid",
};
const marker = `export-http-${crypto.randomUUID()}`,
  subscriptionId = new ObjectId(),
  fixtureIds: ObjectId[] = [],
  jobIds: ObjectId[] = [],
  refs: string[] = [];
const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const storage = Bun.serve({
  hostname: "127.0.0.1",
  port: 3205,
  async fetch(request) {
    const url = new URL(request.url),
      key = url.pathname;
    if (
      !request.headers.has("authorization") &&
      !url.searchParams.has("X-Amz-Signature")
    )
      return new Response(null, { status: 403 });
    if (request.method === "PUT") {
      objects.set(key, {
        bytes: new Uint8Array(await request.arrayBuffer()),
        type: request.headers.get("content-type")!,
      });
      return new Response(null, { headers: { ETag: '"synthetic"' } });
    }
    const object = objects.get(key);
    if (!object) return new Response(null, { status: 404 });
    return new Response(request.method === "HEAD" ? null : object.bytes, {
      headers: {
        "Content-Type": object.type,
        "Content-Length": String(object.bytes.length),
        "Content-Disposition":
          url.searchParams.get("response-content-disposition") ?? "inline",
      },
    });
  },
});
const store = createObjectStore({
  S3_ENDPOINT: "http://127.0.0.1:3205",
  S3_REGION: "local",
  S3_BUCKET: "synthetic-p6",
  S3_ACCESS_KEY_ID: "synthetic",
  S3_SECRET_ACCESS_KEY: "synthetic-local-secret",
});
const worker = createLinkExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  queueName: `http-exports-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true }),
  base = `${login.origin}/api/link-exports/${login.workspace}`,
  headers = { Origin: login.origin };
let sourceKey = "";
const ownedTagIds: ObjectId[] = [];
const foreignId = new ObjectId(),
  foreignSlug = `export-foreign-${crypto.randomUUID().slice(0, 8)}`;
try {
  await db
    .collection(physicalNames.subscriptions)
    .insertOne({
      _id: subscriptionId,
      workspaceId: workspace._id,
      polarSubscriptionId: marker,
      status: "active",
      plan: "pro",
      currentPeriodStart: new Date(Date.now() - 86400000),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
      cancelAtPeriodEnd: false,
    });
  const previousTags = await collection(db, "tags")
    .find({
      workspaceId: workspace._id,
      name: { $in: [marker, "North, South"] },
    })
    .toArray();
  const previousTagIds = new Set(
    previousTags.map((tag) => tag._id.toHexString()),
  );
  const created = await createLink(ctx, {
    url: `https://example.com/${marker}?utm_source=one&utm_source=two#part`,
    title: "'=São João, editorial",
    tags: [marker, "North, South"],
  });
  if (!created.ok) throw new Error(created.error);
  sourceKey = created.value.key;
  ownedTagIds.push(
    ...created.value.tags
      .filter(
        (tag) => /^[a-f\d]{24}$/i.test(tag.id) && !previousTagIds.has(tag.id),
      )
      .map((tag) => new ObjectId(tag.id)),
  );
  const source = (await collection(db, "links").findOne({
    _id: new ObjectId(created.value.id),
  }))!;
  fixtureIds.push(source._id);
  const rows = Array.from({ length: 4998 }, (_, index) => ({
    ...source,
    _id: new ObjectId(),
    urlCode: `${marker}-${index}`,
    key: `${marker}-${index}`,
  }));
  await collection(db, "links").insertMany(rows);
  fixtureIds.push(...rows.map((row) => row._id));
  const context = await browser.newContext({ acceptDownloads: true }),
    page = await context.newPage();
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const api = context.request;
  assert.equal(
    (await fetch(`${base}/download/${crypto.randomUUID()}`)).status,
    401,
  );
  assert.equal(
    (
      await api.post(base, {
        headers: { Origin: "https://evil.invalid" },
        data: { format: "csv" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (await api.post(base, { data: { format: "csv" } })).status(),
    403,
  );
  assert.equal(
    (
      await api.post(base, {
        headers: { ...headers, "content-type": "text/csv" },
        data: "url\nhttps://example.com",
      })
    ).status(),
    415,
  );
  assert.equal(
    (
      await api.post(base, {
        headers: { ...headers, "content-type": "application/json" },
        data: "{",
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await api.post(base, {
        headers,
        data: { format: "csv", filter: { search: { $ne: "" } } },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await api.post(base, {
        headers,
        data: { format: "csv", data: "x".repeat(40000) },
      })
    ).status(),
    413,
  );
  const filter = { tags: [marker] },
    smallResponse = await api.post(base, {
      headers,
      data: { format: "csv", filter },
    });
  assert.equal(smallResponse.status(), 201);
  const small = await smallResponse.json();
  assert.equal(small.mode, "download");
  assert.equal(small.total, 4999);
  refs.push(small.downloadUrl.split("/").at(-1));
  assert.equal(smallResponse.headers()["cache-control"], "private, no-store");
  for (const hidden of [
    "selection",
    "workspaceId",
    "createdBy",
    "objectKey",
    "filter",
    source._id.toHexString(),
  ])
    assert.equal(JSON.stringify(small).includes(hidden), false);
  const extra = {
    ...source,
    _id: new ObjectId(),
    urlCode: `${marker}-extra`,
    key: `${marker}-extra`,
  };
  await collection(db, "links").insertOne(extra);
  fixtureIds.push(extra._id);
  const downloaded = page.waitForEvent("download");
  const head = await api.head(`${login.origin}${small.downloadUrl}`);
  assert.equal(head.status(), 200);
  assert.equal((await head.body()).length, 0);
  assert.match(head.headers()["content-disposition"]!, /shortn-links.csv/);
  await page.evaluate((href) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = "Synthetic HTTP download";
    document.body.append(anchor);
    anchor.click();
  }, small.downloadUrl);
  const file = await downloaded;
  assert.equal(file.suggestedFilename(), "shortn-links.csv");
  const bytes = await readFile((await file.path())!);
  assert.equal(parseImportCsv(bytes).records.length, 4999);
  assert.equal(bytes.toString().includes(`${marker}-extra`), false);
  const table = parseImportCsv(bytes),
    decoded = mapImportRecord(
      table,
      detectImportMapping(table.columns),
      table.records[0]!,
    );
  assert.equal(decoded.ok, true);
  if (decoded.ok) {
    assert.equal(decoded.input.url, source.longUrl);
    assert.equal(decoded.input.title, source.title);
    assert.deepEqual(
      [...decoded.input.tags!].sort(),
      [marker, "North, South"].sort(),
    );
  }
  const repeat = await api.get(`${login.origin}${small.downloadUrl}`);
  assert.equal(repeat.status(), 200);
  assert.equal(repeat.headers()["x-content-type-options"], "nosniff");
  assert.equal(repeat.headers()["cache-control"], "private, no-store");
  assert.match(repeat.headers().vary ?? "", /cookie/i);
  const foreignWorkspace = {
    ...workspace,
    _id: foreignId,
    slug: foreignSlug,
    name: "Synthetic export foreign",
    personal: false,
  };
  delete foreignWorkspace.legacySub;
  await db.collection(physicalNames.workspaces).insertOne(foreignWorkspace);
  await db
    .collection(physicalNames.workspace_members)
    .insertOne({
      _id: new ObjectId(),
      workspaceId: foreignId,
      userId: login.userId,
      role: "owner",
      joinedAt: new Date(),
    });
  const foreignAccess = await api.post(
    `${login.origin}/api/link-exports/${foreignSlug}`,
    { headers, data: { format: "csv" } },
  );
  assert.equal(foreignAccess.status(), 403);
  assert.equal((await foreignAccess.json()).error, "feature_required");
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/link-exports/${foreignSlug}/download/${refs[0]}`,
      )
    ).status(),
    404,
  );
  const selectionKey = `exports:selection:${workspace._id}:${login.userId}:${refs[0]}`,
    selection = JSON.parse((await durable.get(selectionKey))!);
  selection.expiresAt = new Date(0).toISOString();
  await durable.set(selectionKey, JSON.stringify(selection), "EX", 900);
  assert.equal(
    (await api.get(`${login.origin}${small.downloadUrl}`)).status(),
    404,
  );
  assert.equal(
    (await api.head(`${login.origin}${small.downloadUrl}`)).status(),
    404,
  );
  const requestId = crypto.randomUUID(),
    largeResponse = await api.post(base, {
      headers,
      data: { format: "json", filter, requestId },
    });
  assert.equal(largeResponse.status(), 202);
  const large = await largeResponse.json();
  assert.equal(large.mode, "job");
  assert.equal(large.job.total, 5000);
  jobIds.push(new ObjectId(large.job.id));
  assert.equal(
    (
      await api.post(base, {
        headers,
        data: { format: "json", filter, requestId },
      })
    ).status(),
    202,
  );
  assert.equal(
    (
      await api.post(base, {
        headers,
        data: { format: "csv", filter, requestId },
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/link-exports/${foreignSlug}/jobs/${large.job.id}`,
      )
    ).status(),
    404,
  );
  const queued = await api.get(`${login.origin}${large.statusUrl}`);
  assert.equal(queued.status(), 200);
  assert.equal((await queued.json()).state, "pending");
  await worker.pump();
  let completed;
  for (let i = 0; i < 100; i++) {
    const response = await api.get(`${login.origin}${large.statusUrl}`);
    completed = await response.json();
    if (completed.state === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(completed.state, "completed");
  assert.equal(completed.done, 5000);
  for (const hidden of [
    "leaseToken",
    "objectKey",
    "requestKey",
    "createdBy",
    "filter",
    "selection",
  ])
    assert.equal(JSON.stringify(completed).includes(hidden), false);
  const artifact = await api.get(completed.downloadUrl);
  assert.equal(artifact.status(), 200);
  assert.equal((await artifact.json()).length, 5000);
  assert.match(artifact.headers()["content-disposition"]!, /links.json/);
  assert.equal(
    (
      await api.post(`${login.origin}${large.statusUrl}`, {
        headers,
        data: { action: "cancel" },
      })
    ).status(),
    409,
  );
  const cancelResponse = await api.post(base, {
      headers,
      data: { format: "csv", filter },
    }),
    cancelJob = await cancelResponse.json();
  assert.equal(cancelResponse.status(), 202);
  jobIds.push(new ObjectId(cancelJob.job.id));
  assert.equal(
    (
      await api.post(`${login.origin}${cancelJob.statusUrl}`, {
        headers: { Origin: "https://evil.invalid" },
        data: { action: "cancel" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await api.post(`${login.origin}${cancelJob.statusUrl}`, {
        headers,
        data: { action: "cancel" },
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await api.post(`${login.origin}${cancelJob.statusUrl}`, {
        headers,
        data: { action: "cancel" },
      })
    ).status(),
    200,
  );
  assert.equal(
    (await (await api.get(`${login.origin}${cancelJob.statusUrl}`)).json())
      .state,
    "cancelled",
  );
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscriptionId }, { $set: { status: "canceled" } });
  assert.equal(
    (
      await api.post(base, { headers, data: { format: "csv", filter } })
    ).status(),
    403,
  );
  assert.equal(
    (await api.get(`${login.origin}${large.statusUrl}`)).status(),
    403,
  );
  const directory = ".impeccable/review/p6-link-export-http";
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        fixtures: 5000,
        checks: [
          "session auth",
          "origin protection",
          "bounded JSON/invalid input",
          "server-only instant selection",
          "browser CSV attachment",
          "4,999/5,000 boundary",
          "selection cannot grow",
          "workspace-bound tokens and jobs",
          "token expiry",
          "job retry idempotency",
          "private current-attempt JSON delivery",
          "cancel",
          "live plan loss",
        ],
        passed: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "HTTP link export checks passed: 4,999-row browser attachment, 5,000-row private job and access boundaries.",
  );
} finally {
  await worker.worker.close();
  await worker.queue.obliterate({ force: true });
  await worker.close();
  await browser.close();
  storage.stop(true);
  await collection(db, "links").deleteMany({ _id: { $in: fixtureIds } });
  await collection(db, "tags").deleteMany({
    workspaceId: workspace._id,
    _id: { $in: ownedTagIds },
  });
  if (sourceKey)
    await cache.unlink(
      `link:shortn.invalid:${sourceKey}`,
      `cache-generation:link:shortn.invalid:${sourceKey}`,
    );
  await linkExportJobs(db).deleteMany({ _id: { $in: jobIds } });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  await db
    .collection(physicalNames.workspace_members)
    .deleteMany({ workspaceId: foreignId });
  await db.collection(physicalNames.workspaces).deleteOne({ _id: foreignId });
  for (const ref of refs)
    await durable.del(
      `exports:selection:${workspace._id}:${login.userId}:${ref}`,
    );
  for (const pattern of [
    `link:shortn.invalid:${marker}*`,
    `cache-generation:link:shortn.invalid:${marker}*`,
  ]) {
    let cursor = "0";
    do {
      const [next, keys] = await cache.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        1000,
      );
      cursor = next;
      if (keys.length) await cache.unlink(...keys);
    } while (cursor !== "0");
  }
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
