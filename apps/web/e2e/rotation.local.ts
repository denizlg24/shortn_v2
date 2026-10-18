import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { compileRules, rotationCookieName } from "@shortn/core";
import { createApp } from "../../redirect/src/app";

const directory = await mkdtemp(join(tmpdir(), "shortn-rotation-"));
const certificate = join(directory, "cert.pem"),
  key = join(directory, "key.pem");
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
try {
  const generated = Bun.spawn(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      "/CN=rotation.shortn.test",
      "-days",
      "1",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  assert.equal(
    await generated.exited,
    0,
    "Could not generate loopback TLS certificate",
  );
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    tls: { key: await readFile(key), cert: await readFile(certificate) },
    fetch: (request) =>
      new URL(request.url).hostname === "example.test"
        ? new Response("<!doctype html><title>Rotation destination</title>", {
            headers: { "Content-Type": "text/html" },
          })
        : app.fetch(request),
  });
  const origin = `https://rotation.shortn.test:${server.port}`,
    target = `https://example.test:${server.port}`,
    id = "0123456789abcdef01234567";
  let rules = compileRules({
    rotation: [
      { url: `${target}/a`, weight: 1 },
      { url: `${target}/b`, weight: 3 },
    ],
  });
  const app = createApp({
    resolver: {
      resolve: async () => ({
        kind: "link",
        id,
        key: "abc",
        dest: `${target}/default`,
        status: "ok",
        pwd: false,
        ...(rules ? { rules } : {}),
      }),
    },
    enqueue: () => {},
    health: async () => true,
    secrets: { legacy: new Uint8Array(32) },
    origin,
    linkDomain: "rotation.shortn.test",
  });
  browser = await chromium.launch({
    headless: true,
    args: [
      "--host-resolver-rules=MAP rotation.shortn.test 127.0.0.1, MAP example.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${origin}/abc`);
  const destination = page.url(),
    first = (await context.cookies(origin)).find(
      (cookie) => cookie.name === rotationCookieName(id),
    )!;
  assert(first);
  assert(first.httpOnly && first.secure && first.sameSite === "Lax");
  assert(first.expires > Date.now() / 1000 + 3500);
  await page.goto(`${origin}/abc`);
  assert.equal(page.url(), destination);
  const second = (await context.cookies(origin)).find(
    (cookie) => cookie.name === first.name,
  )!;
  assert.equal(second.value, first.value);
  assert.equal(second.expires, first.expires);
  rules = compileRules({
    rotation: [
      { url: `${target}/a`, weight: 2 },
      { url: `${target}/b`, weight: 1 },
    ],
  });
  await page.goto(`${origin}/abc`);
  assert.notEqual(
    (await context.cookies(origin)).find(
      (cookie) => cookie.name === first.name,
    )!.value,
    first.value,
  );
  await context.close();
  console.log(
    "Loopback HTTPS browser rotation persists across cross-site navigation without refresh and resets on configuration change",
  );
} finally {
  await browser?.close();
  await server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
