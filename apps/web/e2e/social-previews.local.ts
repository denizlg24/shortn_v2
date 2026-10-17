import { strict as assert } from "node:assert";
import { chromium } from "playwright-core";
import { createApp } from "../../redirect/src/app";
import type { ClickMessage } from "@shortn/core";
const title = '"><script>alert("x")</script>& Café';
const destination =
  "https://example.com/O'Reilly;news?x=1&signed=abc%2B123#section";
const messages: ClickMessage[] = [];
const app = createApp({
  resolver: {
    resolve: async () => ({
      kind: "link",
      id: "0123456789abcdef01234567",
      key: "preview",
      dest: destination,
      status: "ok",
      pwd: false,
      og: {
        title,
        description: 'Text with "quotes" & accents: ação',
        image: "https://images.example.com/card.png?a=1&b=2",
      },
    }),
  },
  enqueue: (message) => messages.push(message),
  health: async () => true,
  secrets: { legacy: new Uint8Array(32) },
  origin: "https://shortn.at",
  linkDomain: "shortn.at",
});
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ userAgent: "Twitterbot/1.0" });
  const page = await context.newPage();
  let fetchedImage = false;
  await context.route("https://images.example.com/**", (route) => {
    fetchedImage = true;
    return route.abort();
  });
  await context.route("https://example.com/**", (route) =>
    route.fulfill({ body: "Destination", contentType: "text/html" }),
  );
  const response = await fetch(`${server.url.origin}/preview?token=secret`, {
    headers: { "user-agent": "Twitterbot/1.0" },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  const metadata = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    return {
      title: document
        .querySelector('meta[property="og:title"]')!
        .getAttribute("content"),
      image: document
        .querySelector('meta[property="og:image"]')!
        .getAttribute("content"),
      canonical: document
        .querySelector('meta[property="og:url"]')!
        .getAttribute("content"),
      refresh: document
        .querySelector('meta[http-equiv="refresh"]')!
        .getAttribute("content"),
      scripts: document.scripts.length,
      link: document.querySelector("a")!.getAttribute("href"),
    };
  }, html);
  assert.equal(metadata.title, title);
  assert.equal(metadata.image, "https://images.example.com/card.png?a=1&b=2");
  assert.equal(metadata.canonical, "https://shortn.at/preview");
  assert.equal(metadata.scripts, 0);
  assert.equal(metadata.link, destination);
  assert.equal(metadata.refresh, `0;url="${destination}"`);
  await page.goto(`${server.url.origin}/preview`, { waitUntil: "commit" });
  await page.waitForURL(destination);
  assert.equal(fetchedImage, false);
  assert.equal(messages.length, 2);
  assert(messages.every((message) => message.bot));
  const human = await fetch(`${server.url.origin}/preview`, {
    redirect: "manual",
    headers: { "user-agent": "Mozilla/5.0 Chrome/129.0" },
  });
  assert.equal(human.status, 302);
  assert.equal(human.headers.get("location"), destination);
  await context.close();
  console.log(
    "Social preview browser checks passed: decoded metadata, no script injection/image fetch, exact refresh destination and human redirect",
  );
} finally {
  await browser.close();
  server.stop(true);
}
