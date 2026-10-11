import { Hono } from "hono";
import type { Db } from "mongodb";
import { receivePolarWebhook } from "./webhooks";

export interface AppDeps {
  db: Db;
  webhookSecret: string;
  health: () => Promise<boolean>;
  log: (message: string, error?: unknown) => void;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
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
  app.notFound((c) => c.json({ error: "not_found" }, 404));
  app.onError((error, c) => {
    deps.log("api error", error);
    return c.json({ error: "internal" }, 500);
  });
  return app;
}
