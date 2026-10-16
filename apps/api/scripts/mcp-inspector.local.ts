import { strict as assert } from "node:assert";
import { MongoClient, ObjectId } from "mongodb";
import { Redis } from "ioredis";
import {
  createApiKey,
  ensurePersonalWorkspace,
  type ServiceContext,
} from "@shortn/core";
import { collection } from "@shortn/db";
import { createMcpApp } from "../src/mcp";

const mongoUrl = process.env.MONGO_TEST_URL!,
  redisUrl = process.env.REDIS_TEST_URL!;
for (const value of [mongoUrl, redisUrl])
  assert(
    value && ["localhost", "127.0.0.1"].includes(new URL(value).hostname),
    "Explicit loopback services required",
  );
const mongo = await new MongoClient(mongoUrl).connect();
const db = mongo.db(
    `shortn_mcp_inspector_${crypto.randomUUID().replaceAll("-", "")}`,
  ),
  cache = new Redis(redisUrl);
let fetchHandler: (request: Request) => Response | Promise<Response> = () =>
  new Response(null, { status: 503 });
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) => fetchHandler(request),
});
const origin = `http://127.0.0.1:${server.port}`;
let keyId: string | undefined;
try {
  const userId = new ObjectId().toHexString(),
    pepper = "synthetic-inspector-pepper-".repeat(3);
  const workspace = await ensurePersonalWorkspace(db, {
    id: userId,
    name: "Inspector fixture",
  });
  await collection(db, "workspaces").updateOne(
    { _id: workspace._id },
    { $set: { platformFeatures: { mcp: true } } },
  );
  const ctx: ServiceContext = {
    db,
    cache,
    workspace,
    actor: { userId, role: "owner" },
    linkDomain: "shortn.invalid",
  };
  const created = await createApiKey(
    ctx,
    { name: "Inspector temporary", scopes: ["links:read", "workspace:read"] },
    pepper,
  );
  if (!created.ok) throw new Error(created.error);
  keyId = created.value.key.id;
  fetchHandler = createMcpApp({
    db,
    cache,
    pepper,
    origin,
    linkDomain: ctx.linkDomain,
    clientIp: () => "127.0.0.1",
    log: (message) => console.error(message),
  }).fetch;
  for (const method of [
    "tools/list",
    "resources/list",
    "prompts/list",
    "tools/call",
  ]) {
    const args: string[] = [
      "bunx",
      "@modelcontextprotocol/inspector@2.11.0",
      "--cli",
      `${origin}/mcp`,
      "--transport",
      "http",
      "--header",
      `Authorization: Bearer ${created.value.secret}`,
      "--method",
      method,
    ];
    if (method === "tools/call") args.push("--tool-name", "get_usage");
    const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    // Do not print CLI diagnostics: a failing CLI may echo credential arguments.
    assert.equal(
      code,
      0,
      `Inspector ${method} failed: ${(error + output).replaceAll(created.value.secret, "[redacted]")}`,
    );
    assert(output.length > 0, `Inspector ${method} returned no evidence`);
    if (method === "tools/list")
      assert(output.includes("archive_link") && output.includes("get_usage"));
    if (method === "tools/call")
      assert(
        output.includes("consumed") && !output.includes('"isError": true'),
      );
    console.log(`Inspector ${method}: passed over loopback HTTP`);
  }
} finally {
  server.stop(true);
  if (keyId) await cache.del(`api:rate:${keyId}`, `apikey:last-used:${keyId}`);
  await db.dropDatabase();
  await mongo.close();
  cache.disconnect();
}
