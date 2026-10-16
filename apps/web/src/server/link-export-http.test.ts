import { expect, test } from "bun:test";
import {
  readExportJson,
  sameExportOrigin,
  linkExportFileResponse,
} from "./link-export-http";

test("export mutation origin is exact and metadata is bounded without Content-Length", async () => {
  const origin = "https://app.example";
  for (const value of [
    "https://app.example.evil.test",
    "https://app.example/path",
    "https://user@app.example",
    "null",
    "http://app.example",
    "https://other.example",
    "",
  ])
    expect(
      sameExportOrigin(
        new Request(origin, { headers: value ? { origin: value } : {} }),
        origin,
      ),
    ).toBe(false);
  expect(
    sameExportOrigin(new Request(origin, { headers: { origin } }), origin),
  ).toBe(true);
  let cancelled = false,
    chunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks++;
      controller.enqueue(new Uint8Array(8192));
    },
    cancel() {
      cancelled = true;
    },
  });
  const oversized = await readExportJson(
    new Request(origin, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit),
  );
  expect(oversized).toMatchObject({ ok: false, status: 413 });
  expect(cancelled).toBe(true);
  expect(chunks).toBeLessThanOrEqual(6);
  expect(
    await readExportJson(
      new Request(origin, {
        method: "POST",
        headers: { "content-type": "text/csv" },
        body: "url\nhttps://example.com",
      }),
    ),
  ).toMatchObject({ ok: false, status: 415 });
  expect(
    await readExportJson(
      new Request(origin, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    ),
  ).toMatchObject({ ok: false, status: 400 });
  expect(
    await readExportJson(
      new Request(origin, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: '{"format":"csv"}',
      }),
    ),
  ).toEqual({ ok: true, value: { format: "csv" } });
});
test("file adapter preserves backpressure, private attachment headers and closes the iterator on cancellation", async () => {
  let produced = 0,
    closed = false,
    aborted = false;
  const iterator = async function* () {
    try {
      for (let i = 0; i < 5000; i++) {
        produced++;
        yield new TextEncoder().encode(`row-${i}\n`);
      }
    } finally {
      closed = true;
    }
  };
  const response = await linkExportFileResponse(
    iterator(),
    "csv",
    new AbortController().signal,
    () => {
      aborted = true;
    },
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-disposition")).toContain(
    'filename="shortn-links.csv"',
  );
  expect(produced).toBeLessThan(5);
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toBe("row-0\n");
  await reader.cancel();
  expect(closed).toBe(true);
  expect(aborted).toBe(true);
  expect(produced).toBeLessThan(5);
});
test("file adapter forwards request abort and successful EOF without retaining resources", async () => {
  let closed = false;
  const iterator = async function* () {
    try {
      yield new Uint8Array([1]);
      yield new Uint8Array([2]);
    } finally {
      closed = true;
    }
  };
  const abort = new AbortController(),
    response = await linkExportFileResponse(
      iterator(),
      "json",
      abort.signal,
      () => undefined,
    );
  const reader = response.body!.getReader();
  await reader.read();
  abort.abort();
  await expect(reader.read()).rejects.toThrow("export_cancelled");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(closed).toBe(true);
  const complete = await linkExportFileResponse(
    iterator(),
    "json",
    new AbortController().signal,
    () => undefined,
  );
  expect(new Uint8Array(await complete.arrayBuffer())).toEqual(
    new Uint8Array([1, 2]),
  );
});
