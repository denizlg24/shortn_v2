# Shortn TypeScript client

The client is generated from the same Zod/OpenAPI routes served at
`/openapi.json`. It covers the implemented v1 routes; the P6 checklist still
tracks unfinished API resources.

```ts
import { createShortnClient } from "@shortn/api/client";

const shortn = createShortnClient({
  apiKey: process.env.SHORTN_API_KEY!,
  // Override for staging or a local API server.
  baseUrl: "https://api.shortn.at",
});
const { data, error, response } = await shortn.POST("/v1/links", {
  headers: { "Idempotency-Key": crypto.randomUUID() },
  body: { url: "https://example.com" },
});
if (error) console.error(error.code, response.status);
else console.log(data.id);
```

Keep keys in server processes. They authorize requests through the creator's
live workspace membership and scopes. The client forwards RFC 9457 problem
responses and response headers; it does not automatically retry mutations.
Reuse the same idempotency key and payload when retrying the same POST.

Lists return `nextCursor`. Pass it in `params.query.cursor` for the next page;
retain filters while paging. Bio draft patches require the revision returned by
a fresh `GET /v1/bio-pages/{id}`. Blocks replace their ordered list, while theme
and SEO patches merge provided fields. Publish the returned revision explicitly.

From the repository root:

```sh
bun run --cwd apps/api gen:contracts
bun run --cwd apps/api check:contracts
bun run --cwd apps/api typecheck
```

Generation needs no credentials, server, MongoDB or Redis. It validates the
OpenAPI document through openapi-typescript/Redocly, writes `apps/api/openapi.json`
and `client/schema.d.ts`, and applies the repository's Prettier configuration.
Commit both generated files after a route/schema change. CI regenerates in
memory, rejects drift, and compiles the client and positive/negative request
examples in `contracts.ts`. Runtime client tests use injected fetch functions.
