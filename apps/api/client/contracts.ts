import type { createShortnClient } from "./index";

// Compiled by the API typecheck; never executed. Examples deliberately span
// request bodies, path/query parameters, problem responses and draft patches.
export async function clientTypeContract(
  client: ReturnType<typeof createShortnClient>,
) {
  const list = await client.GET("/v1/links", {
    params: { query: { limit: 25 } },
  });
  if (list.data) {
    const id: string | undefined = list.data.items[0]?.id;
    const cursor: string | null = list.data.nextCursor;
    void [id, cursor];
  }
  const created = await client.POST("/v1/links", {
    body: { url: "https://example.com" },
    headers: { "Idempotency-Key": "example" },
  });
  if (created.error) {
    const code: string = created.error.code;
    void code;
  }
  await client.GET("/v1/links/{id}/analytics", {
    params: {
      path: { id: "example" },
      query: {
        from: "2026-10-01T00:00:00Z",
        to: "2026-10-02T00:00:00Z",
        groupBy: "country",
      },
    },
  });
  await client.PATCH("/v1/bio-pages/{id}", {
    params: { path: { id: "example" } },
    body: {
      revision: 1,
      content: { theme: { density: "compact" }, seo: { noindex: true } },
    },
  });
  await client.POST("/v1/bio-pages/{id}/publish", {
    params: { path: { id: "example" } },
    body: { revision: 2 },
  });
  await client.GET("/v1/domains/{id}/status", {
    params: { path: { id: "example" } },
  });
  await client.GET("/v1/qr-codes", { params: { query: { limit: 25 } } });
  const exported = await client.GET("/v1/qr-codes/{id}/export", {
    params: { path: { id: "example" }, query: { format: "pdf", size: 1024 } },
    redirect: "manual",
  });
  if (exported.data) {
    const jobId: string = exported.data.id;
    const status = await client.GET("/v1/qr-exports/{id}", {
      params: { path: { id: jobId } },
    });
    const url: string | undefined = status.data?.downloadUrl;
    void url;
  }
  const webhook = await client.POST("/v1/webhooks", {
    body: {
      name: "Events",
      url: "https://example.com/hook",
      events: ["link.created"],
    },
  });
  const zip = await client.POST("/v1/qr-codes/export", {
    body: { ids: ["example"], format: "svg", size: 1024 },
  });
  if (zip.data) {
    const progress = await client.GET("/v1/qr-exports/zip/{id}", {
      params: { path: { id: zip.data.id } },
    });
    const total: number | undefined = progress.data?.total;
    const url: string | undefined = progress.data?.downloadUrl;
    void [total, url];
  }
  if (webhook.data) {
    const secret: string = webhook.data.secret;
    void secret;
  }
  await client.POST("/v1/webhooks/{id}/test", {
    params: { path: { id: "example" } },
  });
  await client.POST("/v1/webhooks/{id}/deliveries/{deliveryId}/redeliver", {
    params: { path: { id: "example", deliveryId: "delivery" } },
  });
  // @ts-expect-error Creating a link requires its destination.
  await client.POST("/v1/links", { body: {} });
  // @ts-expect-error An item read requires its path parameter.
  await client.GET("/v1/links/{id}", {});
  // @ts-expect-error Analytics requires a time range.
  await client.GET("/v1/analytics", { params: { query: {} } });
  await client.POST("/v1/bio-pages/{id}/publish", {
    params: { path: { id: "example" } },
    // @ts-expect-error Publishing requires an explicit revision.
    body: {},
  });
}
