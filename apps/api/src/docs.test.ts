import { expect, test } from "bun:test";
import type { Db } from "mongodb";
import { createApp } from "./app";

test("public documentation is available when REST rollout and infrastructure are disabled", async () => {
  const app = createApp({
    get db(): Db {
      throw new Error("Documentation touched database");
    },
    webhookSecret: "",
    health: async () => false,
    log: () => {
      throw new Error("Unexpected docs error");
    },
  });
  for (const path of [
    "/docs",
    "/docs/api",
    "/docs.md",
    "/docs/getting-started.md",
    "/llms.txt",
    "/llms-full.txt",
    "/openapi.json",
  ]) {
    expect((await app.request(path)).status).toBe(200);
  }
  expect((await app.request("/v1/workspace")).status).toBe(404);
});

test("public mirror preflight allows bearer requests while actual requests still require auth", async () => {
  const { createRestApi } = await import("./rest");
  const app = createRestApi({
    get db(): Db {
      throw new Error("Unauthenticated request touched database");
    },
    get cache(): never {
      throw new Error("Unauthenticated request touched cache");
    },
    get durable(): never {
      throw new Error("Unauthenticated request touched durable Redis");
    },
    pepper: "",
    linkDomain: "shortn.at",
    rolloutPercent: 0,
    clientIp: () => undefined,
    log: () => {},
  });
  const preflight = await app.request("/v1/links", {
    method: "OPTIONS",
    headers: {
      Origin: "https://shortn.at",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers":
        "authorization,content-type,idempotency-key",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("Access-Control-Allow-Headers")).toContain(
    "Idempotency-Key",
  );
  expect(preflight.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  const anonymous = await app.request("/v1/links", {
    headers: { Origin: "https://shortn.at" },
  });
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const cookieOnly = await app.request("/v1/links", {
    headers: { Cookie: "session=fake" },
  });
  expect(cookieOnly.status).toBe(401);
});
