import { expect, test } from "bun:test";
import { createHandler, type Env } from "./index";
const env: Env = {
  REDIRECT_ORIGIN: "https://redirect-origin.shortn.at",
  WEB_ORIGIN: "https://web-origin.shortn.at",
  CANARY_PERCENT: "100",
  EDGE_AUTH_SECRET: "edge-secret",
  BIO_DELIVERY_ENABLED: "1",
  BIO_SUBDOMAINS: "1",
  BIO_INTERNAL_SECRET: "bio-secret",
};
test("bio hosts carry authenticated identity and discard cookies and spoofed headers", async () => {
  let seen: Request | undefined;
  const handler = createHandler(
    async () => new Response("redirect"),
    async () => new Response("legacy"),
    50,
    async (request) => {
      seen = request;
      return new Response("bio", { headers: { "set-cookie": "oops=1" } });
    },
  );
  const result = await handler(
    new Request("https://alice.shortn.at/", {
      headers: {
        cookie: "session=private",
        "x-shortn-bio-handle": "bob",
        "x-bio-auth": "forged",
        rsc: "1",
      },
    }),
    env,
  );
  expect(seen?.url).toBe("https://web-origin.shortn.at/_bio/alice");
  expect(seen?.headers.get("x-shortn-bio-handle")).toBe("alice");
  expect(seen?.headers.get("x-bio-auth")).toBe("bio-secret");
  expect(seen?.headers.get("cookie")).toBeNull();
  expect(seen?.headers.get("rsc")).toBeNull();
  expect(result.headers.get("set-cookie")).toBeNull();
  expect(result.headers.get("cache-control")).toContain("s-maxage=60");
});
test("bio hosts serve the default favicon from the web origin", async () => {
  let seen: Request | undefined;
  const handler = createHandler(
    async () => new Response("redirect"),
    async () => new Response("legacy"),
    50,
    async (request) => {
      seen = request;
      return new Response("icon");
    },
  );
  const result = await handler(
    new Request("https://alice.shortn.at/favicon.ico"),
    env,
  );
  expect(result.status).toBe(200);
  expect(seen?.url).toBe("https://web-origin.shortn.at/favicon.ico");
});
test("custom hosts preserve form bodies and authenticated host context", async () => {
  let seen: Request | undefined;
  const handler = createHandler(
    async (request) => {
      seen = request;
      return new Response("custom");
    },
    async () => new Response("legacy"),
  );
  await handler(
    new Request("https://go.example.com/authenticate/sale/verify", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-host": "evil.example",
        "x-shortn-forwarded-host": "evil.example",
      },
      body: "password=secret",
    }),
    env,
  );
  expect(seen?.headers.get("x-forwarded-host")).toBe("go.example.com");
  expect(seen?.headers.get("x-shortn-forwarded-host")).toBe("go.example.com");
  expect(seen?.headers.get("x-edge-auth")).toBe("edge-secret");
  expect(await seen?.text()).toBe("password=secret");
});
test("P5 switches preserve direct legacy rendering and staging has no wildcard", async () => {
  const seen: string[] = [];
  const handler = createHandler(
    async (request) => {
      seen.push(request.url);
      return new Response("redirect");
    },
    async () => new Response("legacy"),
  );
  expect(
    await (
      await handler(new Request("https://shortn.at/b/alice"), {
        ...env,
        BIO_DELIVERY_ENABLED: "0",
      })
    ).text(),
  ).toBe("legacy");
  expect(
    await (
      await handler(new Request("https://alice.shortn.at/"), {
        ...env,
        BIO_SUBDOMAINS: "0",
      })
    ).text(),
  ).toBe("legacy");
  await handler(new Request("https://shortn.at/b/alice/"), env);
  expect(seen).toEqual(["https://redirect-origin.shortn.at/b/alice/"]);
});
