import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient, ObjectId, type Db } from "mongodb";
import { physicalNames } from "@shortn/db";
import { encodeSecret, ensurePersonalWorkspace } from "@shortn/core";
import { createApp } from "./app";

const mongoUrl = process.env.MONGO_TEST_URL;
if (!mongoUrl && process.env.REQUIRE_INTEGRATION === "1")
  throw new Error("Mongo fixture required");

(mongoUrl ? describe : describe.skip)(
  "custom-domain public page forwarding",
  () => {
    let client: MongoClient, db: Db, hostname: string;
    const seen: Headers[] = [];
    const web = Bun.serve({
      port: 0,
      fetch(request) {
        seen.push(request.headers);
        return new Response("ok");
      },
    });
    beforeAll(async () => {
      if (!["127.0.0.1", "localhost"].includes(new URL(mongoUrl!).hostname))
        throw new Error("Loopback Mongo required");
      client = await new MongoClient(mongoUrl!).connect();
      db = client.db(
        `shortn_forward_${crypto.randomUUID().replaceAll("-", "")}`,
      );
      const userId = new ObjectId().toHexString();
      const workspace = await ensurePersonalWorkspace(db, {
        id: userId,
        name: "Forward",
        sub: `auth|${userId}`,
      });
      await db.collection(physicalNames.subscriptions).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: crypto.randomUUID(),
        status: "active",
        plan: "pro",
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 29 * 86400000),
        cancelAtPeriodEnd: false,
      });
      const addon = crypto.randomUUID();
      hostname = `${crypto.randomUUID().slice(0, 8)}.example.test`;
      await db.collection(physicalNames.domain_addons).insertOne({
        workspaceId: workspace._id,
        polarSubscriptionId: addon,
        status: "active",
      });
      await db.collection(physicalNames.domains).insertOne({
        workspaceId: workspace._id,
        hostname,
        kind: "links",
        status: "active",
        hostnameStatus: "active",
        sslStatus: "active",
        addonSubscriptionId: addon,
      });
    });
    afterAll(async () => {
      web.stop(true);
      await db?.dropDatabase();
      await client?.close();
    });

    test("the web app receives the edge-proven visitor address, not the proxy's", async () => {
      const app = createApp({
        resolver: { resolve: async () => ({ kind: "missing" }) },
        enqueue: () => {},
        health: async () => true,
        secrets: { legacy: encodeSecret("legacy-secret") },
        origin: "https://shortn.at",
        linkDomain: "shortn.at",
        edgeAuthSecret: "synthetic-edge-secret",
        db,
        bio: {
          enabled: true,
          subdomains: false,
          redirects: false,
          webOrigin: web.url.origin,
          secret: "synthetic-bio-secret",
        },
        log: () => {},
      });
      const response = await app.request("/authenticate/abc", {
        headers: {
          "x-edge-auth": "synthetic-edge-secret",
          "x-shortn-forwarded-host": hostname,
          "cf-connecting-ip": "2a06:98c0:3600::103",
          "x-shortn-client-ip": "203.0.113.7",
        },
      });
      expect(response.status).toBe(200);
      expect(seen.at(-1)?.get("x-bio-auth")).toBe("synthetic-bio-secret");
      expect(seen.at(-1)?.get("x-shortn-client-ip")).toBe("203.0.113.7");
    });
  },
);
