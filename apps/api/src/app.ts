import { Hono } from "hono";
import { createDocumentationApp } from "@shortn/docs";
import type { Db } from "mongodb";
import { receivePolarWebhook } from "./webhooks";
import { receiveBioView } from "./bio-views";
import { bodyLimit } from "hono/body-limit";
import { createRestApi, type RestDeps } from "./rest";
import { createMcpApp, type McpDeps } from "./mcp";

export interface AppDeps {
  db: Db;
  webhookSecret: string;
  health: () => Promise<boolean>;
  log: (message: string, error?: unknown) => void;
  bioViews?: Omit<Parameters<typeof receiveBioView>[1], "db">;
  rest?: Omit<RestDeps, "db" | "log">;
  mcp?: Omit<McpDeps, "db" | "log">;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  if (deps.mcp)
    app.route("/", createMcpApp({ ...deps.mcp, db: deps.db, log: deps.log }));
  app.post("/v1/bio/view", bodyLimit({ maxSize: 4096 }), async (c) =>
    deps.bioViews
      ? receiveBioView(c.req.raw, { ...deps.bioViews, db: deps.db })
      : c.json({ error: "disabled" }, 404),
  );
  app.get("/__health", async (c) =>
    (await deps.health()) ? c.json({ ok: true }) : c.json({ ok: false }, 503),
  );
  app.post("/webhooks/polar", async (c) => {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const result = await receivePolarWebhook(
      { body: await c.req.text(), headers, secret: deps.webhookSecret },
      deps,
    );
    return c.json(result, result.status);
  });
  if (deps.rest)
    app.route("/", createRestApi({ ...deps.rest, db: deps.db, log: deps.log }));
  else app.route("/", createDocumentationApp({ apiRoot: true }));
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    deps.log("api error", error);
    return c.json({ error: "internal" }, 500);
  });
  return app;
}
