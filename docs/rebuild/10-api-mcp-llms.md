# 10 — Public API, MCP Server & llms.txt

All three call `packages/core` services. There's no business logic in handlers.

## REST API v1 (`api.shortn.at/v1`)

- Hono + `@hono/zod-openapi`: zod schemas define validation, types **and** `/openapi.json`. Docs at `api.shortn.at/docs` (Scalar) and mirrored into `shortn.at/docs/api`.
- **Auth:** `Authorization: Bearer sk_live_…` API keys. Session cookies aren't accepted on `api.` (no CSRF surface).
- **Resources:**

| Resource        | Endpoints                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Links           | `GET/POST /links`, `GET/PATCH/DELETE /links/{id}`, `GET /links/by-key/{domain}/{key}`, `POST /links/bulk` (≤ 1000), `POST /links/{id}/restore` |
| QR              | `GET/POST /qr-codes`, `GET/PATCH/DELETE /qr-codes/{id}`, `GET /qr-codes/{id}/export?format=svg                                                 | png | pdf&size=` |
| Analytics       | `GET /analytics?…` (mirrors `analytics.query`, 04), `GET /links/{id}/analytics`                                                                |
| Tags, Campaigns | CRUD                                                                                                                                           |
| Bio pages       | `GET/POST /bio-pages`, `PATCH` blocks/theme, `POST /{id}/publish`                                                                              |
| Domains         | `GET/POST/DELETE /domains`, `GET /domains/{id}/status`                                                                                         |
| Webhooks        | CRUD + `POST /webhooks/{id}/test`                                                                                                              |
| Workspace       | `GET /workspace`, `GET /workspace/usage`                                                                                                       |

- **Conventions:** cursor pagination (`?cursor=&limit=`), `Idempotency-Key` header on POST (stored in Redis for 24 h with the response), RFC 9457 problem+json errors with stable `code`s, ISO dates, IDs as strings, `?expand=tags,campaign`.
- **Rate limits:** Redis sliding window per key with plan-based limits (e.g. 60/min basic, 600/min pro). `RateLimit-*` headers (IETF draft) are sent.
- **Versioning:** path-versioned. Additive changes ship without a version bump. Breaking changes → `/v2` with a 12-month overlap.

### API keys

- Created in Settings → API keys with a name, **scopes** (`links:read`, `links:write`, `analytics:read`, `qr:*`, `bio:*`, `domains:*`, `webhooks:*`), an optional expiry, and an optional IP allowlist.
- Format `sk_live_{24 random base62}`. We store `sha256(key + API_KEY_PEPPER)`, a prefix for display (`sk_live_ab12…`), `lastUsedAt` (updated at most once per minute via Redis), and `createdBy`.
- Shown once. Roll and revoke are supported, and revocation is instant (Redis cache `apikey:{hash}` is deleted).
- Actor = key with scopes ∩ the creator's role at use time. If the creator leaves the workspace, their keys are disabled.

## Outgoing webhooks

Events: `link.created|updated|deleted`, `link.clicked` (opt-in, batched every 10 s or per 100 events), `qr.scanned`, `bio.published`, `domain.verified`. Signed with `Shortn-Signature: t=…,v1=HMAC-SHA256` (Stripe-style). Delivery through BullMQ with exponential retries over 24 h. Endpoints are auto-disabled after 3 days of failures, with an email. Delivery log in the UI (`webhook_deliveries`, TTL 30 d) with redeliver.

## MCP server (`api.shortn.at/mcp`)

- `@modelcontextprotocol/sdk` with **Streamable HTTP** transport, mounted in apps/api.
- **Auth:** OAuth 2.1 (better-auth's OIDC provider / MCP plugin) so Claude and other MCP clients can do a standard consent flow scoped to a workspace. API keys are also accepted as bearer tokens for headless agents. The same scopes and authz as REST.
- **Tools** (each a thin wrapper over the core service, with zod input schemas and concise structured output):
  - `create_link {url, key?, domain?, title?, tags?, utm?, expiresAt?}` → short URL
  - `update_link`, `archive_link`, `get_link {key|id}`, `search_links {query, tag?, campaign?, limit}`
  - `get_analytics {linkKey|tag|campaign, range, groupBy?}` → compact table + summary sentence
  - `create_qr_code {linkKey, style?}` → QR export URL
  - `list_campaigns`, `create_campaign`, `add_bio_link {page, url, title}`, `get_usage`
- **Resources:** `shortn://links/{key}`, `shortn://analytics/summary` (last 7 days).
- **Prompts:** "weekly link report", "create campaign links for these URLs".
- **Safety:** destructive tools (`archive_link`) are annotated `destructiveHint: true`. Every MCP mutation lands in `audit_log` with `actor: mcp:{client}`.
- Listed in the docs with a one-click config snippet for Claude Desktop/Code, Cursor and VS Code.

## llms.txt

- `shortn.at/llms.txt`: a short, curated index (what Shortn is, links to API reference, MCP setup, docs pages as `.md`), following the llms.txt convention.
- `shortn.at/llms-full.txt`: generated at build time from the docs MDX + OpenAPI (endpoint list with params) for single-fetch ingestion.
- Every docs page is also served as markdown at `{url}.md`.
- Both are generated by `bun run gen:llms` in CI so they never drift from the OpenAPI spec.
- `robots.txt` keeps allowing AI crawlers for docs/marketing. Bio pages respect each page's `noindex` toggle.

## Acceptance

- The OpenAPI spec validates, and a generated TS client (`openapi-typescript`) compiles in CI.
- A contract test suite hits every endpoint with key scopes on/off (authz matrix).
- MCP: the inspector connects, and every tool succeeds on staging. The Claude Desktop flow (OAuth) is verified manually.
- `llms.txt` is reachable, valid markdown, and every link resolves.
