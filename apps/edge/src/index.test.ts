import { expect, test } from "bun:test";
import { bucket, createHandler } from "./index";
import type { Env } from "./index";

const env: Env = {
  REDIRECT_ORIGIN: "https://redirect-origin.shortn.at",
  CANARY_PERCENT: "100",
  EDGE_AUTH_SECRET: "edge-secret",
};

function setup(redirect: (request: Request) => Promise<Response>) {
  const seen = { redirect: [] as Request[], legacy: [] as Request[] };
  const handler = createHandler(
    async (request) => {
      seen.redirect.push(request);
      return redirect(request);
    },
    async (request) => {
      seen.legacy.push(request);
      return new Response("legacy", { status: 200 });
    },
    50,
  );
  return { handler, seen };
}

const redirected = async () =>
  new Response(null, {
    status: 302,
    headers: { location: "https://example.com" },
  });

test("single-segment keys and /qr/ paths go to apps/redirect with edge headers", async () => {
  const { handler, seen } = setup(redirected);
  const response = await handler(
    new Request("https://shortn.at/abc?utm_source=x", {
      headers: {
        "cf-connecting-ip": "203.0.113.1",
        "cf-ipcountry": "PT",
        "cf-ray": "ray1",
        cookie: "a=b",
      },
    }),
    env,
  );
  expect(response.status).toBe(302);
  const forwarded = seen.redirect[0];
  expect(forwarded?.url).toBe(
    "https://redirect-origin.shortn.at/abc?utm_source=x",
  );
  expect(forwarded?.headers.get("x-edge-auth")).toBe("edge-secret");
  expect(forwarded?.headers.get("cf-connecting-ip")).toBe("203.0.113.1");
  expect(forwarded?.headers.get("x-request-id")).toBe("ray1");
  await handler(new Request("https://shortn.at/qr/abc"), env);
  expect(seen.redirect[1]?.url).toBe(
    "https://redirect-origin.shortn.at/qr/abc",
  );
  expect(seen.legacy).toHaveLength(0);
});

test("everything else stays on legacy", async () => {
  const { handler, seen } = setup(redirected);
  for (const path of [
    "/",
    "/en/dashboard",
    "/pricing",
    "/b/page",
    "/_next/static/x.js",
    "/logo.png",
    "/api/auth/session",
  ])
    await handler(new Request(`https://shortn.at${path}`), env);
  await handler(new Request("https://shortn.at/abc", { method: "POST" }), env);
  expect(seen.redirect).toHaveLength(0);
  expect(seen.legacy).toHaveLength(8);
});

test("5xx, errors and timeouts fall back to legacy", async () => {
  for (const failure of [
    async () => new Response("down", { status: 503 }),
    async () => {
      throw new Error("tunnel");
    },
    () => new Promise<Response>(() => {}),
  ]) {
    const { handler, seen } = setup(failure);
    const response = await handler(new Request("https://shortn.at/abc"), env);
    expect(await response.text()).toBe("legacy");
    expect(seen.legacy).toHaveLength(1);
  }
});

test("CANARY_PERCENT=0 is the kill switch", async () => {
  const { handler, seen } = setup(redirected);
  await handler(new Request("https://shortn.at/abc"), {
    ...env,
    CANARY_PERCENT: "0",
  });
  expect(seen.redirect).toHaveLength(0);
  expect(bucket("anything")).toBeLessThan(100);
});

test("P4 column is off until WEB_ORIGIN and DASHBOARD_HANDOFF are set", async () => {
  const { handler, seen } = setup(redirected);
  await handler(new Request("https://shortn.at/authenticate/abc"), env);
  const dashboard = await handler(
    new Request("https://shortn.at/en/dashboard/links"),
    env,
  );
  expect(seen.legacy).toHaveLength(2);
  expect(dashboard.status).toBe(200);
});

test("with the P4 column, public link pages go to web and dashboards to the handoff", async () => {
  const p4: Env = {
    ...env,
    WEB_ORIGIN: "https://app.shortn.at",
    DASHBOARD_HANDOFF: "1",
  };
  const webSeen: Request[] = [];
  const handler = createHandler(
    redirected,
    async () => new Response("legacy"),
    50,
    async (request) => {
      webSeen.push(request);
      return new Response(null, { status: 303, headers: { location: "/abc" } });
    },
  );
  const post = await handler(
    new Request("https://shortn.at/authenticate/abc", {
      method: "POST",
      body: "password=x",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "a=b",
      },
    }),
    p4,
  );
  expect(post.status).toBe(303);
  expect(webSeen[0]?.url).toBe("https://app.shortn.at/authenticate/abc");
  expect(webSeen[0]?.headers.get("x-forwarded-host")).toBe("shortn.at");
  expect(await webSeen[0]?.text()).toBe("password=x");
  await handler(new Request("https://shortn.at/pt/safety/abc"), p4);
  expect(webSeen[1]?.url).toBe("https://app.shortn.at/pt/safety/abc");
  const dashboard = await handler(
    new Request("https://shortn.at/pt/dashboard/qr-codes"),
    p4,
  );
  expect(dashboard.status).toBe(302);
  expect(dashboard.headers.get("location")).toBe(
    "https://shortn.at/api/handoff?from=%2Fpt%2Fdashboard%2Fqr-codes",
  );
});

test("only the public link routes match the web paths", async () => {
  const { isWebPath } = await import("./index");
  for (const path of [
    "/authenticate/abc",
    "/authenticate/abc/verify",
    "/pt/safety/abc",
    "/en/safety/abc/token",
    "/es/safety/abc/report",
  ])
    expect(isWebPath(path)).toBe(true);
  for (const path of [
    "/abc",
    "/authenticate",
    "/de/safety/abc",
    "/en/safety/abc/other",
    "/en/dashboard",
  ])
    expect(isWebPath(path)).toBe(false);
});

test("a failing web origin falls back to legacy for the same request", async () => {
  const p4: Env = { ...env, WEB_ORIGIN: "https://app.shortn.at" };
  let legacyBody = "";
  const handler = createHandler(
    redirected,
    async (request) => {
      legacyBody = await request.text();
      return new Response("legacy");
    },
    50,
    async () => new Response("down", { status: 502 }),
  );
  const response = await handler(
    new Request("https://shortn.at/authenticate/abc", {
      method: "POST",
      body: "password=x",
    }),
    p4,
  );
  expect(await response.text()).toBe("legacy");
  expect(legacyBody).toBe("password=x");
});
