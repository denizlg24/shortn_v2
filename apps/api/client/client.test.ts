import { expect, test } from "bun:test";
import { createShortnClient } from "./index";

test("typed client sends bearer keys, cursor queries and idempotency headers", async () => {
  const requests: Request[] = [];
  const client = createShortnClient({
    apiKey: "sk_live_fixture",
    baseUrl: "https://api.example.com",
    fetch: async (request) => {
      requests.push(request);
      return new Response(
        JSON.stringify(
          request.method === "POST"
            ? { id: "created" }
            : { items: [], nextCursor: null },
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await client.GET("/v1/links", {
    params: {
      query: { cursor: "cursor-value", limit: 25, tags: "tag-one,tag-two" },
    },
  });
  await client.POST("/v1/links", {
    body: { url: "https://example.com/destination" },
    headers: { "Idempotency-Key": "create-once" },
  });
  expect(requests[0]?.headers.get("Authorization")).toBe(
    "Bearer sk_live_fixture",
  );
  const url = new URL(requests[0]!.url);
  expect(url.origin).toBe("https://api.example.com");
  expect(url.searchParams.get("cursor")).toBe("cursor-value");
  expect(url.searchParams.get("tags")).toBe("tag-one,tag-two");
  expect(url.href).not.toContain("sk_live_fixture");
  expect(requests[1]?.method).toBe("POST");
  expect(requests[1]?.headers.get("Idempotency-Key")).toBe("create-once");
  expect(await requests[1]?.json()).toEqual({
    url: "https://example.com/destination",
  });
});

test("typed client requests QR formats and polls typed private delivery", async () => {
  const requests: Request[] = [];
  const client = createShortnClient({
    apiKey: "sk_live_synthetic",
    baseUrl: "https://api.example.com",
    fetch: async (request) => {
      requests.push(request);
      return Response.json(
        {
          id: "synthetic",
          state: requests.length === 1 ? "pending" : "completed",
          format: "pdf",
          size: 1024,
          createdAt: "2026-10-15T00:00:00Z",
          expiresAt: "2026-10-16T00:00:00Z",
          ...(requests.length > 1
            ? { downloadUrl: "https://storage.example/private-synthetic" }
            : {}),
        },
        { status: requests.length === 1 ? 202 : 200 },
      );
    },
  });
  const queued = await client.GET("/v1/qr-codes/{id}/export", {
    params: { path: { id: "qr-id" }, query: { format: "pdf", size: 1024 } },
    redirect: "manual",
  });
  const jobId: string = queued.data!.id;
  const completed = await client.GET("/v1/qr-exports/{id}", {
    params: { path: { id: jobId } },
  });
  expect(completed.data?.downloadUrl).toBe(
    "https://storage.example/private-synthetic",
  );
  expect(new URL(requests[0]!.url).searchParams.get("format")).toBe("pdf");
  expect(requests[0]!.redirect).toBe("manual");
  expect(requests[1]!.headers.get("Authorization")).toBe(
    "Bearer sk_live_synthetic",
  );
});

test("typed client preserves RFC 9457 errors and rate headers", async () => {
  const client = createShortnClient({
    apiKey: "fixture",
    fetch: async () =>
      new Response(
        JSON.stringify({
          type: "https://shortn.at/docs/api/errors#insufficient_scope",
          title: "insufficient scope",
          status: 403,
          code: "insufficient_scope",
          instance: "/v1/links",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/problem+json",
            "RateLimit-Remaining": "29",
          },
        },
      ),
  });
  const result = await client.GET("/v1/links");
  expect(result.data).toBeUndefined();
  expect(result.error?.code).toBe("insufficient_scope");
  expect(result.response.headers.get("RateLimit-Remaining")).toBe("29");
});
