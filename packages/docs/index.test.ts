import { expect, test } from "bun:test";
import { createDocumentationApp, documentation } from "./index";

const docs = createDocumentationApp();

test("curated index links resolve without credentials, with matching markdown content types", async () => {
  const index = await docs.request("/llms.txt");
  expect(index.status).toBe(200);
  expect(index.headers.get("content-type")).toContain("text/markdown");
  const links = [
    ...(await index.text()).matchAll(/\]\((https:\/\/shortn\.at\/[^)]+)\)/g),
  ];
  expect(links.length).toBeGreaterThan(6);
  for (const [, link] of links) {
    const response = await docs.request(new URL(link!).pathname);
    expect(response.status).toBe(200);
    if (link!.endsWith(".md") || link!.endsWith(".txt"))
      expect(response.headers.get("content-type")).toContain("text/markdown");
  }
});

test("every authored docs page has an HTML and markdown route and internal links resolve", async () => {
  for (const [slug, page] of Object.entries(documentation.pages)) {
    const path = slug === "index" ? "/docs" : `/docs/${slug}`;
    expect((await docs.request(path)).status).toBe(200);
    expect(await (await docs.request(`${path}.md`)).text()).toBe(page.markdown);
    for (const [, link] of page.markdown.matchAll(/\]\((\/[^)]+)\)/g)) {
      // Guides also link to marketing pages, which apps/web serves itself.
      if (/^\/(?:en|pt|es)(?:\/|$)/.test(link!)) continue;
      expect((await docs.request(link!)).status).toBe(200);
    }
  }
  expect((await docs.request("/docs/missing")).status).toBe(404);
});

test("single-fetch documentation preserves every operation, parameter and schema", () => {
  const spec = documentation.spec as {
    paths: Record<string, Record<string, unknown>>;
    components: unknown;
  };
  let operations = 0;
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (
        !["get", "post", "patch", "put", "delete", "head", "options"].includes(
          method,
        )
      )
        continue;
      operations++;
      expect(documentation.full).toContain(
        `## ${method.toUpperCase()} ${path}`,
      );
      expect(documentation.full).toContain(JSON.stringify(operation, null, 2));
    }
  }
  expect(operations).toBeGreaterThanOrEqual(44);
  expect(documentation.full).toContain(
    JSON.stringify(spec.components, null, 2),
  );
});

test("API docs keep live spec registration available and do not persist authorization", async () => {
  const api = createDocumentationApp({ liveSpec: true, apiRoot: true });
  expect((await api.request("/openapi.json")).status).toBe(404);
  const response = await api.request("/docs");
  expect(response.status).toBe(200);
  expect(await response.text()).toMatch(/"persistAuth":\s*false/);
});

test("mirrored staging reference targets staging API and API-hosted docs target their own origin", async () => {
  const mirror = await docs.request("https://staging.shortn.at/openapi.json");
  expect(((await mirror.json()) as { servers: unknown }).servers).toEqual([
    { url: "https://api-staging.shortn.at" },
  ]);
  const api = createDocumentationApp({ apiRoot: true });
  const spec = await api.request("https://api-staging.shortn.at/openapi.json");
  expect(((await spec.json()) as { servers: unknown }).servers).toEqual([
    { url: "https://api-staging.shortn.at" },
  ]);
});
