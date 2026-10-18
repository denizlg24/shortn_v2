import { expect, test } from "bun:test";
import { encodeSecret } from "@shortn/core";
import type { CachedLink, ClickMessage } from "@shortn/core";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { createClickQueue } from "./clicks";
import { createResolver, MemoryLayer, parseInvalidation } from "./resolver";

const id = "0123456789abcdef01234567";
const links: Record<string, CachedLink> = {
  abc: {
    kind: "link",
    id,
    key: "abc",
    dest: "https://example.com/x",
    status: "ok",
    pwd: false,
  },
  qr1: {
    kind: "link",
    id,
    key: "qr1",
    dest: "https://example.com/qr",
    status: "ok",
    pwd: false,
    qr: { id: "abcdefabcdefabcdefabcdef", publicId: "pub" },
  },
  old: { kind: "alias", id, key: "abc" },
  deleted: { kind: "deleted" },
};

function setup(overrides: { edgeAuthSecret?: string; failing?: boolean } = {}) {
  const enqueued: ClickMessage[] = [];
  const resolved: string[] = [];
  const app = createApp({
    resolver: {
      async resolve(domain, key) {
        resolved.push(`${domain}/${key}`);
        if (overrides.failing) throw new Error("mongo down");
        return links[key] ?? { kind: "missing" };
      },
    },
    enqueue: (message) => enqueued.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("legacy-secret") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
    edgeAuthSecret: overrides.edgeAuthSecret,
    log: () => {},
  });
  return { app, enqueued, resolved };
}

test("deleted links return a localized branded 404 without redirecting or tracking", async () => {
  for (const [locale, title] of [
    ["en", "This link is unavailable"],
    ["es", "Este enlace no está disponible"],
    ["pt", "Este link não está disponível"],
  ]) {
    const { app, enqueued } = setup();
    const response = await app.request("/deleted?token=invalid", {
      headers: { cookie: `NEXT_LOCALE=${locale}` },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, max-age=0");
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain("Shortn");
    expect(enqueued).toHaveLength(0);
  }
});

test("redirects to the destination with legacy headers and enqueues one click", async () => {
  const { app, enqueued } = setup();
  const response = await app.request("/abc?utm_source=news", {
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "cf-ipcountry": "PT",
    },
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("https://example.com/x");
  expect(response.headers.get("cache-control")).toBe("private, max-age=0");
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(enqueued).toHaveLength(1);
  expect(enqueued[0]).toMatchObject({
    linkId: id,
    key: "abc",
    domain: "shortn.at",
    bot: false,
    ip: "203.0.113.9",
    country: "PT",
    query: { utm_source: "news" },
  });
});

test("legacy /qr/ paths and trailing slashes resolve the same key; QR links carry the scan target", async () => {
  const { app, enqueued } = setup();
  for (const path of ["/qr/qr1", "/qr1/"]) {
    const response = await app.request(path);
    expect(response.headers.get("location")).toBe("https://example.com/qr");
  }
  expect(enqueued.map((message) => message.qrId)).toEqual([
    "abcdefabcdefabcdefabcdef",
    "abcdefabcdefabcdefabcdef",
  ]);
});

test("missing keys go to the not-found page, aliases 301, bots are flagged", async () => {
  const { app, enqueued } = setup();
  const missing = await app.request("/nope", {
    headers: { cookie: "NEXT_LOCALE=pt" },
  });
  expect(missing.headers.get("location")).toBe(
    "https://shortn.at/en/url-not-found",
  );
  const alias = await app.request("/old");
  expect(alias.status).toBe(301);
  expect(alias.headers.get("location")).toBe("https://shortn.at/abc");
  expect(enqueued).toHaveLength(0);
  await app.request("/abc", { headers: { "user-agent": "Slackbot 1.0" } });
  expect(enqueued[0]?.bot).toBe(true);
});

test("paths that belong to legacy are never resolved", async () => {
  const { app, resolved } = setup();
  for (const path of ["/pricing", "/en/dashboard", "/logo.png", "/a/b"])
    expect((await app.request(path)).status).toBe(404);
  expect(resolved).toHaveLength(0);
});

test("resolution failures answer 503 with Retry-After rather than a wrong redirect", async () => {
  const { app } = setup({ failing: true });
  const response = await app.request("/abc");
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("5");
});

test("the edge secret is enforced when configured, except for health", async () => {
  const { app } = setup({ edgeAuthSecret: "edge" });
  expect((await app.request("/abc")).status).toBe(403);
  expect(
    (await app.request("/abc", { headers: { "x-edge-auth": "edge" } })).status,
  ).toBe(302);
  expect((await app.request("/__health")).status).toBe(200);
});

test("memory layer expires entries and evicts the oldest beyond capacity", async () => {
  const memory = new MemoryLayer(2, 20);
  const value: CachedLink = { kind: "missing" };
  memory.set("a", value);
  memory.set("b", value);
  memory.set("c", value);
  expect(memory.get("a")).toBeUndefined();
  expect(memory.get("c")).toEqual(value);
  await Bun.sleep(30);
  expect(memory.get("c")).toBeUndefined();
});

test("resolver serves memory hits, loads misses once, and evicts on invalidation", async () => {
  const data = new Map<string, string>();
  const store = {
    async eval(script: string, _keys: number, ...args: (string | number)[]) {
      const [key, generation, token, value] = args.map(String);
      if (!key || !generation || !token) throw new Error("bad args");
      if (script.includes("redis.call('GET', KEYS[2])\nif not token")) {
        if (!data.has(generation)) data.set(generation, token);
        return [data.get(generation), data.get(key) ?? null];
      }
      if (script.includes("'EX'")) {
        if (data.get(generation) === token && value) data.set(key, value);
        return "OK";
      }
      data.set(generation, token);
      return Number(data.delete(key));
    },
    del: async (key: string) => Number(data.delete(key)),
  };
  let loads = 0;
  const resolver = createResolver(store, async () => {
    loads++;
    return links.abc ?? { kind: "missing" };
  });
  await resolver.resolve("shortn.at", "abc");
  await resolver.resolve("shortn.at", "abc");
  expect(loads).toBe(1);
  expect(data.get("link:shortn.at:abc")).toContain("example.com");
  const message = parseInvalidation('{"domain":"shortn.at","keys":["abc"]}');
  expect(message).toEqual({ domain: "shortn.at", keys: ["abc"] });
  if (message) resolver.evict(message);
  expect(resolver.memory.size).toBe(0);
  expect(parseInvalidation("nope")).toBeUndefined();
});

test("click queue spools while Redis fails and replays in order", async () => {
  const path = join(tmpdir(), `spool-${crypto.randomUUID()}.ndjson`);
  const written: string[] = [];
  let up = false;
  const stream = {
    async xadd(_key: string, _id: string, ...fields: string[]) {
      if (!up) throw new Error("redis down");
      written.push(fields[1] ?? "");
      return "1-0";
    },
  };
  const queue = createClickQueue(stream, path, () => {});
  const message = (key: string): ClickMessage => ({
    v: 1,
    ts: Date.now(),
    linkId: id,
    domain: "shortn.at",
    key,
    bot: false,
  });
  queue.enqueue(message("a"));
  await Bun.sleep(10);
  queue.enqueue(message("b"));
  await Bun.sleep(10);
  expect(queue.spooled).toBe(2);
  const restarted = createClickQueue(stream, path, () => {});
  await restarted.load();
  expect(restarted.spooled).toBe(2);
  up = true;
  await queue.drain();
  expect(queue.spooled).toBe(0);
  expect(written.map((payload) => JSON.parse(payload).key)).toEqual(["a", "b"]);
  expect(await Bun.file(path).exists()).toBe(false);
  await rm(path, { force: true });
});

test("bio attribution survives an intermediate gate and is cleared after the click", async () => {
  const { app, enqueued } = setup();
  const gated = await app.request(`/old?ref=bio:${id}&block=stable-block`);
  const cookie = gated.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toContain("shortn_bio_old=");
  // A real safety/password return uses the same key; use a carried attribution cookie here.
  const returned = await app.request("/abc", {
    headers: { cookie: cookie!.replace("shortn_bio_old", "shortn_bio_abc") },
  });
  expect(enqueued[0]?.query).toMatchObject({
    ref: `bio:${id}`,
    block: "stable-block",
  });
  expect(returned.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("resolver preserves an explicit local port for the database lookup", async () => {
  let requested = "";
  const store = { eval: async () => ["generation", null], del: async () => 0 };
  const resolver = createResolver(store, async (domain) => {
    requested = domain;
    return { kind: "missing" };
  });
  await resolver.resolve("localhost:3102", "example");
  expect(requested).toBe("localhost:3102");
});

test("scheduled/expired links render branded gates without tracking", async () => {
  for (const [reason, status, title] of [
    ["scheduled", 404, "This link is not active yet"],
    ["expired", 410, "This link has expired"],
  ] as const) {
    const enqueued: ClickMessage[] = [];
    const rule =
      reason === "scheduled"
        ? { activeFrom: Date.now() + 60000 }
        : { expiresAt: Date.now() - 60000 };
    const app = createApp({
      resolver: {
        resolve: async () => ({
          ...links.abc!,
          kind: "link",
          id,
          key: "abc",
          dest: "https://example.com",
          status: "ok",
          pwd: false,
          rules: rule,
        }),
      },
      enqueue: (message) => enqueued.push(message),
      health: async () => true,
      secrets: { legacy: encodeSecret("secret") },
      origin: "https://shortn.at",
      linkDomain: "shortn.at",
    });
    const response = await app.request("/abc?token=secret");
    expect(response.status).toBe(status);
    expect(await response.text()).toContain(title);
    expect(response.headers.get("location")).toBeNull();
    expect(enqueued).toHaveLength(0);
  }
});

test("query and UTM rules change the final location, retain legacy defaults and count permanent redirects", async () => {
  const enqueued: ClickMessage[] = [];
  const app = createApp({
    resolver: {
      resolve: async () => ({
        kind: "link",
        id,
        key: "abc",
        dest: "https://example.com/?source=existing",
        status: "ok",
        pwd: false,
        rules: {
          forwardQuery: true,
          permanent: true,
          utm: { source: "configured" },
        },
      }),
    },
    enqueue: (message) => enqueued.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("secret") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
  });
  const response = await app.request(
    "/abc?source=incoming&extra=ok&token=secret&utm_source=incoming",
  );
  expect(response.status).toBe(301);
  const location = new URL(response.headers.get("location")!);
  expect(location.searchParams.get("source")).toBe("existing");
  expect(location.searchParams.get("extra")).toBe("ok");
  expect(location.searchParams.get("token")).toBeNull();
  expect(location.searchParams.get("utm_source")).toBe("configured");
  expect(enqueued).toHaveLength(1);
  expect(enqueued[0]!.query?.utm_source).toBe("configured");
});

test("rotation cookies are host-only, secure, bounded and do not refresh on sticky hits", async () => {
  const { compileRules, rotationCookieName } = await import("@shortn/core");
  let rules = compileRules({
    rotation: [
      { url: "https://example.com/a", weight: 1 },
      { url: "https://example.com/b", weight: 1 },
    ],
  });
  const messages: ClickMessage[] = [];
  const app = createApp({
    resolver: {
      resolve: async () => ({
        kind: "link",
        id,
        key: "abc",
        dest: "https://example.com",
        status: "ok",
        pwd: false,
        ...(rules ? { rules } : {}),
      }),
    },
    enqueue: (message) => messages.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("secret") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
  });
  const first = await app.request("/abc");
  const cookie = first.headers.get("Set-Cookie")!;
  expect(cookie).toContain(`${rotationCookieName(id)}=`);
  for (const flag of [
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=3600",
    "Path=/",
  ])
    expect(cookie).toContain(flag);
  expect(cookie).not.toContain("Domain=");
  const second = await app.request("/abc", {
    headers: { Cookie: cookie.split(";")[0]! },
  });
  expect(second.headers.get("location")).toBe(first.headers.get("location"));
  expect(second.headers.get("Set-Cookie")).toBeNull();
  expect(messages[1]!.branch).toBe(messages[0]!.branch);
  expect(messages[0]!.branch).toMatch(/^rotation:[01]$/);
  rules = compileRules({
    rotation: [
      { url: "https://example.com/a", weight: 2 },
      { url: "https://example.com/b", weight: 1 },
    ],
  });
  const changed = await app.request("/abc", {
    headers: { Cookie: cookie.split(";")[0]! },
  });
  expect(changed.headers.get("Set-Cookie")).not.toBe(cookie);
});

test("limited links return retryable 503 when their counter is unavailable while gates remain usable", async () => {
  let reads = 0;
  let link: CachedLink = {
    kind: "link",
    id,
    key: "limited",
    dest: "https://example.com",
    status: "ok",
    pwd: false,
    rules: { maxClicks: 1 },
  };
  const app = createApp({
    resolver: { resolve: async () => link },
    enqueue: () => {
      throw new Error("No destination should be tracked");
    },
    health: async () => true,
    secrets: { legacy: encodeSecret("test") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
    log: () => {},
    clickCounter: {
      read: async () => {
        reads++;
        throw new Error("offline");
      },
      untracked: async () => {
        throw new Error("offline");
      },
    },
  });
  const response = await app.request("/limited");
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("5");
  link = { ...link, pwd: true };
  expect((await app.request("/limited")).headers.get("location")).toContain(
    "/authenticate/",
  );
  link = { ...link, pwd: false, status: "blocked" };
  expect((await app.request("/limited")).headers.get("location")).toContain(
    "/safety/",
  );
  link = { ...link, status: "ok", rules: { maxClicks: 0 } };
  expect((await app.request("/limited")).status).toBe(410);
  expect(reads).toBe(1);
});

test("deep handoffs serve localized nonce-protected HTML and record one branch without a rotation cookie", async () => {
  const messages: ClickMessage[] = [];
  const app = createApp({
    resolver: {
      resolve: async () => ({
        kind: "link",
        id,
        key: "deeplink",
        dest: "https://example.com/web",
        status: "ok",
        pwd: false,
        rules: {
          deepLink: {
            ios: 'youtube://watch?v=abc&x="></script><img/src=x>',
            fallback: "store",
            store: { ios: "https://apps.apple.com/app/id123" },
          },
        },
      }),
    },
    enqueue: (message) => messages.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("test") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
  });
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
  for (const locale of ["en", "es", "pt"]) {
    const response = await app.request("/deeplink", {
      headers: { "user-agent": ua, cookie: `NEXT_LOCALE=${locale}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, max-age=0");
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html.match(/<script /g)).toHaveLength(1);
    expect(html).not.toContain("<img/src=x>");
    expect(html).toContain('href="https://apps.apple.com/app/id123"');
    const nonce = /<script nonce="([a-f0-9]+)">/.exec(html)![1];
    expect(response.headers.get("content-security-policy")).toContain(
      `script-src 'nonce-${nonce}'`,
    );
  }
  expect(messages).toHaveLength(3);
  expect(messages.every((message) => message.branch === "deep:ios")).toBe(true);
  expect((await app.request("/deeplink")).status).toBe(302);
});

test("social bots receive escaped OG HTML; humans/search bots redirect and all preview events are bots", async () => {
  const messages: ClickMessage[] = [];
  const og = {
    title: '"><script>alert("x")</script>& Café',
    description: "A description & detail",
    image: "https://images.example.com/card.png?a=1&b=2",
  };
  const app = createApp({
    resolver: {
      resolve: async () => ({
        kind: "link",
        id,
        key: "preview",
        dest: "https://example.com/news?x=1&y=2#section",
        status: "ok",
        pwd: false,
        og,
      }),
    },
    enqueue: (message) => messages.push(message),
    health: async () => true,
    secrets: { legacy: encodeSecret("test") },
    origin: "https://shortn.at",
    linkDomain: "shortn.at",
  });
  for (const ua of [
    "facebookexternalhit/1.1",
    "Twitterbot/1.0",
    "WhatsApp/2.24",
    "Slackbot-LinkExpanding 1.0",
  ]) {
    const response = await app.request("/preview?token=secret", {
      headers: { "user-agent": ua },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("vary")).toBe("User-Agent");
    expect(response.headers.get("cache-control")).toBe("private, max-age=0");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    const html = await response.text();
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("secret");
    expect(html).toContain(
      'property="og:url" content="https://shortn.at/preview"',
    );
    expect(html).toContain(
      'property="og:title" content="&quot;&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp; Café"',
    );
    expect(html).toContain(
      'property="og:image" content="https://images.example.com/card.png?a=1&amp;b=2"',
    );
    expect(html).toContain(
      'http-equiv="refresh" content="0;url=&quot;https://example.com/news?x=1&amp;y=2#section&quot;"',
    );
  }
  expect(messages).toHaveLength(4);
  expect(messages.every((message) => message.bot)).toBe(true);
  for (const ua of [
    "Mozilla/5.0 Chrome/129.0",
    "Googlebot/2.1",
    "Shortn-LinkHealth/1.0",
  ]) {
    const response = await app.request("/preview", {
      headers: { "user-agent": ua },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.com/news?x=1&y=2#section",
    );
    expect(await response.text()).toBe("");
  }
  expect(messages.at(-1)!.bot).toBe(true);
});

test("authenticated original hosts survive a reverse proxy rewriting X-Forwarded-Host", async () => {
  const { app, resolved } = setup({ edgeAuthSecret: "synthetic-edge-secret" });
  const response = await app.request("/abc", {
    headers: {
      "x-edge-auth": "synthetic-edge-secret",
      "x-forwarded-host": "shortn-redirect.denizlg24.com",
      "x-shortn-forwarded-host": "shortn.at",
    },
  });
  expect(response.status).toBe(302);
  expect(resolved).toEqual(["shortn.at/abc"]);
});

test("the original-host header grants no authority without edge authentication", async () => {
  const { app, resolved } = setup({ edgeAuthSecret: "synthetic-edge-secret" });
  const response = await app.request("/abc", {
    headers: {
      "x-forwarded-host": "shortn.at",
      "x-shortn-forwarded-host": "shortn.at",
    },
  });
  expect(response.status).toBe(403);
  expect(resolved).toEqual([]);
  const direct = setup();
  expect(
    (
      await direct.app.request("/abc", {
        headers: { "x-shortn-forwarded-host": "evil.example" },
      })
    ).status,
  ).toBe(302);
  expect(direct.resolved).toEqual(["shortn.at/abc"]);
});

test("click addresses come from the edge header only after edge authentication", async () => {
  const proxied = {
    "cf-connecting-ip": "2a06:98c0:3600::103",
    "x-shortn-client-ip": "203.0.113.7",
  };
  const { app, enqueued } = setup({ edgeAuthSecret: "synthetic-edge-secret" });
  await app.request("/abc", {
    headers: { ...proxied, "x-edge-auth": "synthetic-edge-secret" },
  });
  expect(enqueued.at(-1)?.ip).toBe("203.0.113.7");
  const direct = setup();
  await direct.app.request("/abc", { headers: proxied });
  expect(direct.enqueued.at(-1)?.ip).toBe("2a06:98c0:3600::103");
});
