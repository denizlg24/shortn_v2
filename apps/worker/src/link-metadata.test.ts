import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import type {
  request as httpRequest,
  IncomingMessage,
  RequestOptions,
} from "node:http";
import { fetchLinkTitle, titleFromHtml } from "./link-metadata";

test("Open Graph title wins independent of attribute order/quotes; fallback entities and Unicode are plain text", () => {
  expect(
    titleFromHtml(
      '<title>Fallback</title><META content="Ocean &amp; Sky &#x1f30a;" property="og:title">',
    ),
  ).toBe("Ocean & Sky 🌊");
  expect(
    titleFromHtml("<meta name='og:title' content='A > B'><title>Other</title>"),
  ).toBe("A > B");
  expect(
    titleFromHtml(
      "<!--<meta property='og:title' content='Fake'>--><script><title>Script</title></script><title> Café&nbsp; &amp; &#39;Tea&#39; </title>",
    ),
  ).toBe("Café & 'Tea'");
  expect(
    titleFromHtml(
      '<meta property="og:title" content=""><title>Fallback</title>',
    ),
  ).toBe("Fallback");
  expect(titleFromHtml(`<title>${"A".repeat(199)}🌊</title>`)).toBe(
    "A".repeat(199),
  );
  expect(titleFromHtml("<html><body>No title</body></html>")).toBeNull();
});
function requester(
  responses: {
    status?: number;
    location?: string;
    body?: string;
    type?: string;
    encoding?: string;
  }[],
  seen: { url: URL; options: RequestOptions; destroyed: boolean }[],
) {
  return ((
    url: URL,
    options: RequestOptions,
    callback: (response: IncomingMessage) => void,
  ) => {
    const record = { url, options, destroyed: false };
    seen.push(record);
    const req = new EventEmitter() as EventEmitter & {
      end(): void;
      destroy(): void;
    };
    req.destroy = () => {
      record.destroyed = true;
    };
    req.end = () =>
      queueMicrotask(() => {
        const data = responses.shift() ?? {},
          response = Readable.from([
            Buffer.from(data.body ?? ""),
          ]) as unknown as IncomingMessage;
        response.statusCode = data.status ?? 200;
        response.headers = {
          "content-type": data.type ?? "text/html; charset=utf-8",
          ...(data.location ? { location: data.location } : {}),
          ...(data.encoding ? { "content-encoding": data.encoding } : {}),
        };
        callback(response);
      });
    return req;
  }) as unknown as typeof httpRequest;
}
const publicResolve = async () => [{ address: "8.8.8.8", family: 4 }];
test("every redirect resolves afresh and pins the chosen public address without browser cookies", async () => {
  const seen: { url: URL; options: RequestOptions; destroyed: boolean }[] = [],
    resolved: string[] = [];
  const title = await fetchLinkTitle("https://example.com/start", {
    resolve: async (host) => {
      resolved.push(host);
      return publicResolve();
    },
    request: requester(
      [
        { status: 302, location: "https://example.org/end" },
        { body: "<title>Final title</title>" },
      ],
      seen,
    ),
  });
  expect(title).toBe("Final title");
  expect(resolved).toEqual(["example.com", "example.org"]);
  expect(seen).toHaveLength(2);
  expect(seen[0]!.options.lookup).toBeFunction();
  expect(seen[0]!.options.agent).toBe(false);
  expect(seen[0]!.options.headers).toEqual({
    "User-Agent": "Shortn-LinkMetadata/1.0",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Encoding": "identity",
    Range: "bytes=0-262143",
  });
});
test("literal and DNS-private targets, credentials, unsafe redirects and rebinding never dispatch a private request", async () => {
  for (const url of [
    "http://127.0.0.1",
    "http://169.254.169.254",
    "file:///etc/passwd",
    "https://user:password@example.com",
  ]) {
    const seen: { url: URL; options: RequestOptions; destroyed: boolean }[] =
      [];
    expect(
      await fetchLinkTitle(url, {
        resolve: publicResolve,
        request: requester([], seen),
      }),
    ).toBeNull();
    expect(seen).toHaveLength(0);
  }
  for (const addresses of [
    [{ address: "127.0.0.1", family: 4 }],
    [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ],
  ]) {
    const seen: { url: URL; options: RequestOptions; destroyed: boolean }[] =
      [];
    expect(
      await fetchLinkTitle("https://example.com", {
        resolve: async () => addresses,
        request: requester([], seen),
      }),
    ).toBeNull();
    expect(seen).toHaveLength(0);
  }
  const seen: { url: URL; options: RequestOptions; destroyed: boolean }[] = [];
  expect(
    await fetchLinkTitle("https://example.com", {
      resolve: async (host) =>
        host === "example.org"
          ? [{ address: "::1", family: 6 }]
          : publicResolve(),
      request: requester(
        [{ status: 302, location: "https://example.org" }],
        seen,
      ),
    }),
  ).toBeNull();
  expect(seen).toHaveLength(1);
});
test("HTML reads are bounded, non-HTML/compressed/status errors do not produce titles, and redirect loops stop", async () => {
  const seen: { url: URL; options: RequestOptions; destroyed: boolean }[] = [];
  expect(
    await fetchLinkTitle("https://example.com", {
      resolve: publicResolve,
      request: requester(
        [{ body: `<title>Small head</title>${"x".repeat(300000)}` }],
        seen,
      ),
    }),
  ).toBe("Small head");
  for (const data of [
    { type: "application/json", body: "<title>No</title>" },
    { encoding: "gzip", body: "<title>No</title>" },
    { status: 500, body: "<title>No</title>" },
  ])
    expect(
      await fetchLinkTitle("https://example.com", {
        resolve: publicResolve,
        request: requester([data], []),
      }),
    ).toBeNull();
  const loop: { url: URL; options: RequestOptions; destroyed: boolean }[] = [];
  expect(
    await fetchLinkTitle("https://example.com", {
      resolve: publicResolve,
      request: requester(
        Array(5).fill({ status: 302, location: "/loop" }),
        loop,
      ),
    }),
  ).toBeNull();
  expect(loop).toHaveLength(4);
});
test("DNS and stalled bodies respect the total request deadline", async () => {
  expect(
    await fetchLinkTitle("https://example.com", {
      timeoutMs: 10,
      resolve: async () => await new Promise(() => {}),
    }),
  ).toBeNull();
  const req = new EventEmitter() as EventEmitter & {
    end(): void;
    destroy(): void;
  };
  req.end = () => {};
  let destroyed = false;
  req.destroy = () => {
    destroyed = true;
  };
  expect(
    await fetchLinkTitle("https://example.com", {
      timeoutMs: 10,
      resolve: publicResolve,
      request: (() => req) as unknown as typeof httpRequest,
    }),
  ).toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(destroyed).toBe(true);
});
