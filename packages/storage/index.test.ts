import { describe, expect, test } from "bun:test";
import { createObjectStore, storedUploadKey } from "./index";

describe("private object storage boundaries", () => {
  test("accepts stored uploads and rejects normalization, traversal and origin tricks", () => {
    const origins = ["https://app.shortn.at"];
    expect(
      storedUploadKey(
        "https://app.shortn.at/api/assets/uploads/user/qr.png",
        origins,
      ),
    ).toBe("uploads/user/qr.png");
    for (const url of [
      "https://evil.example/api/assets/uploads/user/qr.png",
      "https://app.shortn.at.evil.example/api/assets/uploads/user/qr.png",
      "https://user@app.shortn.at/api/assets/uploads/user/qr.png",
      "https://app.shortn.at/api/assets/uploads/user/qr.png?url=https://evil.example",
      "https://app.shortn.at/api/assets/uploads/user/qr.png#fragment",
      "https://app.shortn.at/api/assets/uploads/user/%2e%2e/qr.png",
      "https://app.shortn.at/api/assets/uploads/user/../qr.png",
      "https://app.shortn.at/api/assets/uploads/user%2fqr.png/file.png",
      "https://app.shortn.at/api/assets/exports/qr/private.png",
      "http://127.0.0.1/api/assets/uploads/user/qr.png",
    ])
      expect(storedUploadKey(url, origins)).toBeNull();
  });

  test("real SDK PUT/HEAD/GET uses private cache metadata and bounds streamed reads", async () => {
    const objects = new Map<string, { body: Uint8Array; type: string }>();
    const observed = { privateCache: null as string | null };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        expect(request.headers.get("authorization")).toContain(
          "AWS4-HMAC-SHA256",
        );
        if (request.method === "PUT") {
          observed.privateCache = request.headers.get("cache-control");
          objects.set(path, {
            body: new Uint8Array(await request.arrayBuffer()),
            type: request.headers.get("content-type")!,
          });
          return new Response(null, { status: 200 });
        }
        if (path.endsWith("/stream.png")) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(20));
                controller.enqueue(new Uint8Array(20));
                controller.close();
              },
            }),
          );
        }
        const object = objects.get(path);
        if (!object) return new Response(null, { status: 404 });
        return new Response(request.method === "HEAD" ? null : object.body, {
          headers: {
            "Content-Type": object.type,
            "Content-Length": String(object.body.length),
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
      const bytes = new Uint8Array([1, 2, 3, 4]);
      await store.put("exports/qr/workspace/artifact.png", bytes, "image/png");
      expect(observed.privateCache).toBe("private, max-age=86400");
      expect(await store.head("exports/qr/workspace/artifact.png")).toEqual({
        bytes: 4,
        contentType: "image/png",
      });
      expect(await store.get("exports/qr/workspace/artifact.png", 4)).toEqual(
        bytes,
      );
      expect(await store.head("exports/qr/workspace/missing.png")).toBeNull();
      await expect(
        store.get("exports/qr/workspace/artifact.png", 3),
      ).rejects.toThrow("object_too_large");
      await expect(
        store.get("exports/qr/workspace/stream.png", 30),
      ).rejects.toThrow("object_too_large");
      const signed = new URL(
        await store.sign(
          "exports/qr/workspace/artifact.png",
          86400,
          "flyer.png",
        ),
      );
      expect(signed.searchParams.get("X-Amz-Expires")).toBe("86400");
      expect(signed.searchParams.get("response-content-disposition")).toBe(
        'attachment; filename="flyer.png"',
      );
      expect(signed.searchParams.get("response-cache-control")).toBe(
        "private, no-store",
      );
      expect(signed.searchParams.has("X-Amz-Signature")).toBe(true);
      await expect(
        store.sign("exports/qr/workspace/artifact.png", 86401, "flyer.png"),
      ).rejects.toThrow("invalid_delivery");
      await expect(
        store.sign("exports/qr/workspace/artifact.png", 30, 'bad".png'),
      ).rejects.toThrow("invalid_delivery");
      await expect(store.head("exports/../secret")).rejects.toThrow(
        "invalid_object_key",
      );
    } finally {
      server.stop(true);
    }
  });
});
