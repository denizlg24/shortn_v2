# Getting started with the Shortn API

Shortn manages short links, QR codes, campaigns, tags, bio pages and domains in a workspace.
The API is being rolled out behind workspace feature flags. An API key does not enable access to a disabled feature.

## Authentication

Create a key in **Settings → API keys**. Only workspace owners and admins can manage keys.
Copy the secret when it is created; it is shown once. Give each integration the scopes it needs.
The key's permissions are intersected with its creator's current workspace role.
Revocation, membership removal and role changes apply to subsequent requests.

Send `Authorization: Bearer sk_live_…` over HTTPS to `https://api.shortn.at`.
Session cookies do not authenticate REST requests. Never put secrets in URLs or client-side code.

```sh
curl https://api.shortn.at/v1/workspace \
  -H "Authorization: Bearer $SHORTN_API_KEY"
```

## Create a link

Use a key with `links:write`. Keep the same `Idempotency-Key` when retrying a POST.
Use a new key for a different operation. A reused key with a different payload is rejected.

```sh
curl https://api.shortn.at/v1/links \
  -H "Authorization: Bearer $SHORTN_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-integration-create-001' \
  --data '{"url":"https://example.com","title":"Example"}'
```

## Pagination and filters

List endpoints return bounded pages. Use the returned `nextCursor` as the next request's
`cursor`, preserving the other filters. A missing next cursor ends the list.
The reference documents each endpoint's supported `limit`, search and filter parameters.
For a large link library, use tag and campaign filters alongside keyword search;
keep selections by stable link ID across pages. Do not download the whole library to populate a picker.

## Expand related metadata

Link lists and all link lookup routes accept `?expand=tags,campaign`.
Each link keeps its compact `tags` and `utm` fields. Optional full records appear
in `expanded.tags` and `expanded.campaign`. Both are arrays: a link can have
multiple tags and campaigns, and repeated references are returned once.

Requesting tags requires `tags:read`; campaigns requires `campaigns:read`, in
addition to `links:read`. A missing scope returns 403. Unknown expansion names
return 400. Omit `expand` to keep the compact response and avoid the related reads.
Expansion joins only the requested page (at most 200 links), with workspace
isolation and legacy reference support. Deleted, merged without a surviving
alias, or foreign-workspace references are omitted. Campaign link counts are
computed without returning the campaign's full link ID list.

```sh
curl 'https://api.shortn.at/v1/links?limit=50&expand=tags,campaign' \
  -H "Authorization: Bearer $SHORTN_API_KEY"
```

## Errors and retries

Errors use `application/problem+json` with a stable `code`. Dates are ISO strings and IDs are strings.
Check HTTP status and `code`; do not parse human-readable error text.
Rate limits apply per key and expose `RateLimit-*` headers. On a 429, respect `Retry-After`.
Retry transient failures with backoff, preserving the idempotency key for POST requests.
Feature, role and scope failures require configuration changes rather than repeated retries.

See the [API reference](/docs/api), its [markdown version](/docs/api.md),
and the [webhook guide](/docs/webhooks).
