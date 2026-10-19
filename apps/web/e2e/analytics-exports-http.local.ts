/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { analyticsExportJobs, type ServiceContext } from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createAnalyticsExportWorker } from "../../worker/src/analytics-exports";
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
const marker = `analytics-http-${crypto.randomUUID()}`,
  subscriptionId = new ObjectId(),
  jobIds: ObjectId[] = [];
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
const worker = createAnalyticsExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  queueName: `http-analytics-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true }),
  base = `${login.origin}/api/analytics-exports/${login.workspace}`,
  headers = { Origin: login.origin };
const foreignId = new ObjectId(),
  foreignSlug = `analytics-foreign-${crypto.randomUUID().slice(0, 8)}`;
try {
  await db.collection(physicalNames.subscriptions).insertOne({
    _id: subscriptionId,
    workspaceId: workspace._id,
    polarSubscriptionId: marker,
    status: "active",
    plan: "pro",
    currentPeriodStart: new Date(Date.now() - 86400000),
    currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
    cancelAtPeriodEnd: false,
  });
  await collection(db, "workspaces").insertOne({
    _id: foreignId,
    slug: foreignSlug,
    name: "Synthetic foreign workspace",
    personal: false,
    ownerUserId: "foreign",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const ts = new Date(Date.now() - 3600_000),
    from = new Date(ts.getTime() - 60000).toISOString(),
    to = new Date(ts.getTime() + 60000).toISOString();
  await db.collection(physicalNames.click_events).insertMany(
    Array.from({ length: 1005 }, (_, index) => ({
      ts,
      m: {
        workspaceId: workspace._id,
        linkId: new ObjectId(),
        key: marker,
        kind: index % 2 ? "scan" : "click",
      },
      country: marker,
      ipHash: `private-${index % 3}`,
      ua: "private",
      rawIp: "private",
    })),
  );
  const query = {
    mode: "raw",
    format: "ndjson",
    from,
    to,
    filters: { country: marker },
  };
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(`${login.origin}/login`);
  await page.locator('input[name="identifier"]').fill(login.email);
  await page.locator('input[name="password"]').fill(login.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const api = context.request;
  assert.equal(
    (
      await fetch(base, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api.post(base, {
        data: { query },
        headers: { Origin: "https://foreign.invalid" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await api.post(base, {
        data: { query: { ...query, mode: "aggregate" } },
        headers,
      })
    ).status(),
    400,
  );
  assert.equal(
    (await api.post(base, { data: { query, extra: true }, headers })).status(),
    400,
  );
  assert.equal(
    (
      await api.post(base, {
        data: "x".repeat(33000),
        headers: { ...headers, "Content-Type": "application/json" },
      })
    ).status(),
    413,
  );
  assert.equal(
    (
      await api.post(`${login.origin}/api/analytics-exports/${foreignSlug}`, {
        data: { query },
        headers,
      })
    ).status(),
    404,
  );
  const requestId = crypto.randomUUID(),
    prepared = await api.post(base, { data: { query, requestId }, headers });
  assert.equal(prepared.status(), 202);
  assert.equal(prepared.headers()["cache-control"], "private, no-store");
  assert(
    prepared
      .headers()
      .vary.toLowerCase()
      .split(",")
      .map((value) => value.trim())
      .includes("cookie"),
  );
  assert.equal(prepared.headers()["x-content-type-options"], "nosniff");
  const value = await prepared.json(),
    id = value.job.id;
  jobIds.push(new ObjectId(id));
  assert.equal(value.job.state, "pending");
  assert(!("filters" in value.job));
  assert.equal(
    (
      await (
        await api.post(base, { data: { query, requestId }, headers })
      ).json()
    ).job.id,
    id,
  );
  assert.equal(
    (
      await api.post(base, {
        data: { query: { ...query, format: "csv" }, requestId },
        headers,
      })
    ).status(),
    409,
  );
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/link-exports/${login.workspace}/jobs/${id}`,
      )
    ).status(),
    404,
  );
  const awaitComplete = async (jobId: string) => {
    await worker.pump();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const response = await api.get(`${base}/jobs/${jobId}`);
      assert.equal(response.status(), 200);
      const status = await response.json();
      if (status.state === "completed") return status;
      assert.notEqual(status.state, "failed");
      await Bun.sleep(100);
    }
    throw new Error("Analytics worker completion timeout");
  };
  const complete = await awaitComplete(id);
  assert.equal(complete.done, 1005);
  assert(complete.downloadUrl);
  const download = await api.get(complete.downloadUrl);
  assert.equal(download.status(), 200);
  const rows = (await download.text())
    .trim()
    .split("\n")
    .map((row) => JSON.parse(row));
  assert.equal(rows.length, 1005);
  assert.equal(rows[0].key, marker);
  assert(!("ipHash" in rows[0]));
  assert(!("rawIp" in rows[0]));
  assert.equal(
    (
      await api.post(`${base}/jobs/${id}`, {
        data: { action: "cancel" },
        headers,
      })
    ).status(),
    409,
  );
  for (const mode of ["raw", "aggregate"]) {
    const response = await api.post(base, {
      data: {
        query: { ...query, mode, format: "csv" },
        requestId: crypto.randomUUID(),
      },
      headers,
    });
    assert.equal(response.status(), 202);
    const job = (await response.json()).job;
    jobIds.push(new ObjectId(job.id));
    const done = await awaitComplete(job.id);
    const csv = await (await api.get(done.downloadUrl)).text();
    assert(
      csv.startsWith(
        mode === "raw" ? "timestamp,kind,key" : "section,dimension,value",
      ),
    );
    if (mode === "aggregate") assert(csv.includes('"503","502","3"'));
  }
  const pending = await (
    await api.post(base, { data: { query }, headers })
  ).json();
  jobIds.push(new ObjectId(pending.job.id));
  assert.equal(
    (
      await api.post(`${base}/jobs/${pending.job.id}`, {
        data: { action: "cancel" },
        headers,
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await api.post(`${base}/jobs/${pending.job.id}`, {
        data: { action: "cancel" },
        headers,
      })
    ).status(),
    200,
  );
  const history = await (
    await api.get(`${base}?state=completed&format=csv`)
  ).json();
  assert.equal(
    history.items.filter((row: { id: string }) =>
      jobIds.some((owned) => owned.toHexString() === row.id),
    ).length,
    2,
  );
  assert(!JSON.stringify(history).includes("leaseToken"));
  await analyticsExportJobs(db).updateOne(
    { _id: new ObjectId(id) },
    { $set: { expiresAt: new Date(0) } },
  );
  assert.equal((await api.get(`${base}/jobs/${id}`)).status(), 404);
  await db
    .collection(physicalNames.subscriptions)
    .updateOne({ _id: subscriptionId }, { $set: { plan: "free" } });
  assert.equal(
    (await api.post(base, { data: { query }, headers })).status(),
    403,
  );
  const dir = "test-results/captures/p6-analytics-export-backend";
  await mkdir(dir, { recursive: true });
  await writeFile(
    `${dir}/http-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        rawRows: 1005,
        assertions: [
          "session auth",
          "CSRF origin",
          "bounded metadata",
          "strict formats",
          "tenant isolation",
          "kind isolation",
          "202 job preparation",
          "retry dedupe/conflict",
          "real BullMQ worker",
          "NDJSON safe DTO",
          "raw and aggregate CSV",
          "cancel retry/completed refusal",
          "filtered history",
          "expiry",
          "plan revocation",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Analytics HTTP exports passed: 1005 raw rows, aggregate/raw CSV, private jobs, auth/CSRF, history, expiry and plan gates.",
  );
} finally {
  await browser.close();
  await worker.close();
  await storage.stop(true);
  let cursor = "0";
  do {
    const [next, keys] = await durable.scan(
      cursor,
      "MATCH",
      `bull:${worker.queue.name}:*`,
      "COUNT",
      1000,
    );
    cursor = next;
    if (keys.length) await durable.unlink(...keys);
  } while (cursor !== "0");
  await analyticsExportJobs(db).deleteMany({
    workspaceId: workspace._id,
    createdBy: login.userId,
    kind: "analytics",
    "query.filters.country": marker,
  });
  await db
    .collection(physicalNames.click_events)
    .deleteMany({ "m.workspaceId": workspace._id, "m.key": marker });
  await db
    .collection(physicalNames.subscriptions)
    .deleteOne({ _id: subscriptionId });
  await collection(db, "workspaces").deleteOne({ _id: foreignId });
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
