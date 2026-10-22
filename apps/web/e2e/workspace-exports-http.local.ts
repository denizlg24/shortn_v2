/** Session-authenticated HTTP exports against synthetic loopback services only. */
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import { chromium } from "playwright-core";
import { MongoClient, ObjectId } from "mongodb";
import Redis from "ioredis";
import { collection, physicalNames } from "@shortn/db";
import { workspaceExportJobs, type ServiceContext } from "@shortn/core";
import { createObjectStore } from "@shortn/storage";
import { createWorkspaceExportWorker } from "../../worker/src/workspace-exports";
const login = JSON.parse(await readFile("/tmp/shortn-p6-login.json", "utf8"));
assert.equal(login.origin, "http://localhost:3200");
const mongo = await new MongoClient(
    "mongodb://127.0.0.1:27020/?directConnection=true",
  ).connect(),
  db = mongo.db("shortn_p6_dev");
const cache = new Redis("redis://127.0.0.1:16380/6"),
  durable = new Redis("redis://127.0.0.1:16379/6");
const marker = `workspace-http-${crypto.randomUUID()}`,
  workspaceId = new ObjectId(),
  jobIds: ObjectId[] = [];
const workspace = {
  _id: workspaceId,
  name: "Synthetic export workspace",
  slug: marker,
  personal: false,
  ownerUserId: login.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const ctx: ServiceContext = {
  db,
  cache,
  workspace,
  actor: { userId: login.userId, role: "owner" },
  linkDomain: "shortn.invalid",
};
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
const worker = createWorkspaceExportWorker({
  db,
  cache,
  durable,
  store,
  linkDomain: ctx.linkDomain,
  appUrl: login.origin,
  queueName: `http-workspace-${crypto.randomUUID()}`,
  log: (message) => console.log(message),
});
const browser = await chromium.launch({ headless: true }),
  base = `${login.origin}/api/workspace-exports/${workspace.slug}`,
  headers = { Origin: login.origin };
const linkId = new ObjectId();
try {
  await collection(db, "workspaces").insertOne(workspace);
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId: login.userId,
    role: "owner",
    createdAt: new Date(),
  });
  await db.collection(physicalNames.links).insertOne({
    _id: linkId,
    workspaceId,
    urlCode: marker,
    longUrl: "https://example.com/?utm_source=one&utm_source=two#part",
    title: "São João",
    passwordHash: "PRIVATE_PASSWORD",
  });
  await db.collection(physicalNames.click_events).insertOne({
    ts: new Date(Date.now() - 1000 * 86400_000),
    m: { workspaceId, linkId, key: marker, kind: "click" },
    ipHash: "PRIVATE_VISITOR",
  });
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
        body: "{}",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await api.post(base, {
        data: {},
        headers: { Origin: "https://foreign.invalid" },
      })
    ).status(),
    403,
  );
  for (const data of [
    { to: "attacker@foreign.invalid" },
    { format: "json" },
    { requestId: "bad" },
  ])
    assert.equal((await api.post(base, { data, headers })).status(), 400);
  assert.equal(
    (
      await api.post(base, {
        data: "x".repeat(33000),
        headers: { ...headers, "Content-Type": "application/json" },
      })
    ).status(),
    413,
  );
  const requestId = crypto.randomUUID(),
    response = await api.post(base, { data: { requestId }, headers });
  assert.equal(response.status(), 202);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  assert(response.headers().vary.toLowerCase().includes("cookie"));
  assert.equal(response.headers()["x-content-type-options"], "nosniff");
  const prepared = await response.json(),
    id = prepared.job.id;
  jobIds.push(new ObjectId(id));
  assert.equal(prepared.job.kind, "workspace");
  assert.equal(
    (await (await api.post(base, { data: { requestId }, headers })).json()).job
      .id,
    id,
  );
  assert.equal((await api.post(base, { data: {}, headers })).status(), 409);
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/link-exports/${workspace.slug}/jobs/${id}`,
      )
    ).status(),
    404,
  );
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/analytics-exports/${workspace.slug}/jobs/${id}`,
      )
    ).status(),
    404,
  );
  assert.equal(
    (
      await api.get(
        `${login.origin}/api/workspace-exports/${login.workspace}/jobs/${id}`,
      )
    ).status(),
    404,
  );
  await worker.pump();
  const deadline = Date.now() + 15000;
  let completed: { state: string; downloadUrl?: string } | undefined;
  while (Date.now() < deadline) {
    const value = await (await api.get(`${base}/jobs/${id}`)).json();
    assert.notEqual(value.state, "failed");
    if (value.state === "completed") {
      completed = value;
      break;
    }
    await Bun.sleep(100);
  }
  assert(completed?.downloadUrl);
  const download = await api.get(completed.downloadUrl);
  assert.equal(download.status(), 200);
  assert(download.headers()["content-disposition"]?.includes("workspace.zip"));
  const files = unzipSync(await download.body());
  assert.equal(Object.keys(files).length, 18);
  const links = JSON.parse(Buffer.from(files["links.json"]!).toString());
  assert.equal(links.length, 1);
  assert.equal(
    links[0].url,
    "https://example.com/?utm_source=one&utm_source=two#part",
  );
  const analytics = JSON.parse(
    Buffer.from(files["analytics.json"]!).toString(),
  );
  assert.equal(
    analytics.find((row: { section: string }) => row.section === "total")
      .clicks,
    1,
  );
  const all = Object.values(files)
    .map((bytes) => Buffer.from(bytes).toString())
    .join("\n");
  assert(!all.includes("PRIVATE_PASSWORD"));
  assert(!all.includes("PRIVATE_VISITOR"));
  assert.equal(
    (
      await api.post(`${base}/jobs/${id}`, {
        data: { action: "cancel" },
        headers,
      })
    ).status(),
    409,
  );
  const pending = await (await api.post(base, { data: {}, headers })).json();
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
  const history = await (await api.get(`${base}?state=completed`)).json();
  assert.equal(history.items.length, 1);
  assert(!JSON.stringify(history).includes("requestKey"));
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "admin" } },
  );
  assert.equal((await api.get(`${base}/jobs/${id}`)).status(), 403);
  assert.equal((await api.post(base, { data: {}, headers })).status(), 403);
  await collection(db, "workspace_members").updateOne(
    { workspaceId, userId: login.userId },
    { $set: { role: "owner" } },
  );
  await workspaceExportJobs(db).updateOne(
    { _id: new ObjectId(id) },
    { $set: { expiresAt: new Date(0) } },
  );
  assert.equal((await api.get(`${base}/jobs/${id}`)).status(), 404);
  const directory = "test-results/captures/p6-workspace-export-backend";
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/http-evidence.json`,
    JSON.stringify(
      {
        synthetic: true,
        freePlan: true,
        archiveEntries: 18,
        assertions: [
          "actual session auth",
          "CSRF origin",
          "strict bounded metadata",
          "owner/current role",
          "kind/tenant isolation",
          "retry UUID",
          "real BullMQ/privateS3 ZIP download",
          "all stored aggregates outside free window",
          "secrets excluded",
          "cancel/history/expiry",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Workspace HTTP exports passed: free owner, 18-entry private ZIP, role/kind/tenant isolation, cancellation/history/expiry.",
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
  await workspaceExportJobs(db).deleteMany({ workspaceId });
  await db
    .collection(physicalNames.click_events)
    .deleteMany({ "m.workspaceId": workspaceId });
  await db.collection(physicalNames.links).deleteMany({ workspaceId });
  await collection(db, "workspace_members").deleteMany({ workspaceId });
  await collection(db, "workspaces").deleteOne({ _id: workspaceId });
  cache.disconnect();
  durable.disconnect();
  await mongo.close();
}
