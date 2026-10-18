import { test, expect } from "bun:test";
import { createObjectStore } from "./index";
test("CSV upload grants bind private import key, exact length/type, no overwrite and a short lifetime", async () => {
  const objects = new Map<string, Uint8Array>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "PUT") {
        expect(url.searchParams.has("X-Amz-Signature")).toBe(true);
        expect(request.headers.get("content-type")).toBe(
          "text/csv; charset=utf-8",
        );
        expect(request.headers.get("cache-control")).toBe("private, no-store");
        expect(request.headers.get("if-none-match")).toBe("*");
        if (objects.has(url.pathname))
          return new Response(null, { status: 412 });
        objects.set(url.pathname, new Uint8Array(await request.arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      expect(request.headers.get("authorization")).toContain(
        "AWS4-HMAC-SHA256",
      );
      const object = objects.get(url.pathname);
      if (!object) return new Response(null, { status: 404 });
      return new Response(request.method === "HEAD" ? null : object, {
        headers: {
          "Content-Length": String(object.length),
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    },
  });
  const store = createObjectStore({
    S3_ENDPOINT: `http://127.0.0.1:${server.port}`,
    S3_REGION: "local",
    S3_BUCKET: "synthetic",
    S3_ACCESS_KEY_ID: "synthetic",
    S3_SECRET_ACCESS_KEY: "synthetic-secret",
  });
  try {
    const key = `imports/${"a".repeat(24)}/${"b".repeat(24)}.csv`,
      bytes = new TextEncoder().encode("url\nhttps://example.com\n");
    const url = new URL(await store.signImportUpload!(key, bytes.length));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    const signedHeaders = url.searchParams
      .get("X-Amz-SignedHeaders")!
      .split(";");
    for (const name of [
      "content-length",
      "content-type",
      "if-none-match",
      "cache-control",
    ])
      expect(signedHeaders).toContain(name);
    const headers = {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "private, no-store",
      "if-none-match": "*",
    };
    expect(
      (await fetch(url, { method: "PUT", headers, body: bytes })).status,
    ).toBe(200);
    expect(
      (await fetch(url, { method: "PUT", headers, body: bytes })).status,
    ).toBe(412);
    expect(await store.get(key, 10 * 1024 * 1024)).toEqual(bytes);
    await expect(
      store.signImportUpload!("uploads/user/public.csv", 1),
    ).rejects.toThrow("invalid_import_upload");
    await expect(
      store.signImportUpload!(key, 10 * 1024 * 1024 + 1),
    ).rejects.toThrow("invalid_import_upload");
    await expect(store.signImportUpload!(key, 0)).rejects.toThrow(
      "invalid_import_upload",
    );
    await expect(store.signImportUpload!(key, 1, 901)).rejects.toThrow(
      "invalid_import_upload",
    );
  } finally {
    server.stop(true);
  }
});
