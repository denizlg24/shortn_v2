# 19 — P6 platform implementation and verification

P6 implements [09](09-link-features-and-qr.md), [10](10-api-mcp-llms.md),
[11](11-bulk-import-export.md) and the P6 gate in
[14](14-cutover-and-rollout.md). This checklist tracks the full requested scope;
an individual completed slice does not establish phase completion.

## Entry checkpoint — 2026-10-12

Implementation starts on `feat/p6-platform` from staging `c003f2a`.
P5 development is merged; P5 production acceptance remains separately tracked
in [18](18-p5-breakdown.md). Local pre-existing ignore/cache modifications are
preserved in the stash named `pre-p6 local graft cache and ignore changes`.

## Required implementation and evidence

| Slice                                | Required behavior                                                                                                                                                                                                                                                                | Verification gate                                                                                                                                                                      | State                                                                                                                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 Keys and rollout controls        | Workspace feature flags, deterministic staged rollout, API key create/list/roll/revoke UI, scopes, expiry, IP restrictions, peppered hashes, one-time secret display, live creator membership/role intersection, throttled last-used updates                                     | Role/scope matrix, workspace isolation, immediate revocation, secret redaction, flags default off, pagination                                                                          | Implemented and locally verified; staging and production proxy-origin gates pending                                                                                                                                                                                    |
| 6.2 REST                             | Zod/OpenAPI Hono routes for links (including bulk/restore/by-key), QR/export, analytics, tags, campaigns, bio/publish, domains/status, webhooks/test, workspace/usage; bearer auth only                                                                                          | Every endpoint with scopes on/off; cursor pagination, ISO dates/string IDs, expansions, RFC 9457 errors, Redis rate headers and 24-hour POST idempotency; generated TS client compiles | Forty-nine routes including QR export/job delivery, bulk creation and link expansions implemented; generated client checks added; staging acceptance pending                                                                                                                                           |
| 6.3 Outgoing events                  | Core mutation events, durable BullMQ delivery, timestamped HMAC signatures, 24-hour exponential retries, opt-in click batches (10 seconds/100), scans, publication, domains and import completion, failure disable/email after three days, 30-day delivery log and redelivery UI | Delivery/retry/signature/duplicate/isolation tests with real Redis and local receiver                                                                                                  | Mutation events, batching, delivery, failure email and settings UI implemented locally; import completion implemented locally; staging acceptance pending                                                                                                                               |
| 6.4 MCP                              | Streamable HTTP SDK transport; workspace-scoped OAuth consent and API-key auth; all eleven planned tools, two resources and two prompts; mutation audit actor and destructive annotation                                                                                         | Inspector and every tool on staging; OAuth client flow; role/scope matrix; docs/config for supported clients                                                                           | SDK transport, API-key auth, eleven tool handlers, resources/prompts and audit implemented locally; OAuth provider/token backend verified locally; browser consent/discovery and styled QR export URL verified locally; staging/client acceptance pending                        |
| 6.5 Docs and llms                    | Scalar docs and web mirror, OpenAPI reference, markdown docs routes, generated llms.txt/full from docs and OpenAPI, CI generation and client contract checks, crawler policy                                                                                                     | Spec validation, client compilation, reachable index and every linked page, generation drift check                                                                                     | Scalar mirror, markdown guides, generated llms and CI drift checks implemented locally; staging reachability pending                                                                                                                                                   |
| 6.6 Imports                          | Presigned R2 upload (10 MB/50k rows) or paste, column mapping/20-row preview, worker dry-run/error CSV, whole-import quota reservation, chunks of 500 through shared core validation, row idempotency/checkpoints, progress UI, QR import                                        | 50k rows under five minutes on staging; kill/restart without duplicates; quota refusal before writes; export/import round trip                                                         | Bounded CSV input, dry-run/error CSV, whole-import quota, resumable link/QR workers, cache warming, completion events and in-page dashboard upload/mapping/review/progress/history implemented locally; filtered CSV round trip verified locally; staging acceptance pending |
| 6.7 Exports                          | Filtered links CSV/JSON (stream below 5k, otherwise job), aggregate/raw analytics within retention, selected QR ZIP, full-workspace ZIP/email, R2 signed delivery and 24-hour expiry                                                                                             | Large-library pagination/selection, tenant isolation, retention and round-trip tests, expiry                                                                                           | Selected QR ZIP and dashboard flows implemented locally; filtered link streaming/encoding and durable jobs implemented locally, private dashboard HTTP delivery and in-page review/progress/history implemented locally; analytics job backend/private HTTP implemented locally; analytics dashboard review/progress/history implemented locally; workspace archive/private HTTP/email-outbox implemented locally; workspace dashboard and email sign-in/download flow implemented locally; external acceptance pending |
| 6.8 Link rules                       | Cached in-memory schedule/expiry/max-clicks/fallback, deep links, device/geo targeting, sticky weighted rotation, query/UTM forwarding, permanent redirects, recorded branch; delayed invalidations; bot OG response; destination health jobs                                    | Golden tests for every rule and combined precedence; safety/password preserved; counters and cache boundaries; health informational only                                               | Temporal/query, device/geo, sticky rotation, delayed invalidation and approximate max-clicks and deep links, bot OG and recorded-branch dashboard implemented locally; health jobs/API, dashboard flags/details and host/provider caching implemented locally; external/native acceptance pending |
| 6.9 Link management and QR           | In-page advanced editing, creation/title/key suggestions, bulk tags/campaign/archive/export/delete, 30-day trash/restore/reserved keys; styled worker SVG/PNG/PDF and R2 cache, print constraints and guidance, QR library bulk ZIP                                              | Realistic thousands-of-links browser fixtures, selection across pages/filters, mobile bounds; legacy QR parity; server/client pixel difference below 1% at 1024 px                     | Trash/restore, archive/unarchive with filtered archived browsing, cross-page/filter selection, atomic bulk tagging/campaign moves and styled QR exports with dashboard print/review/progress implemented locally; advanced rule/preview editing and creation paste/title/key/copy helpers implemented locally; circle/frame/caption design treatments implemented locally; production legacy QR acceptance pending                                                                                                                          |
| 6.10 Deferred account authentication | P4 explicitly deferred two-factor, passkeys and Enterprise SSO to P6 (16 D3); workspace gating and account settings must expose the supported flows                                                                                                                              | TOTP/backup recovery, passkey enrollment/login/revoke, SAML/OIDC consent and entitlement coverage; preserve existing login/handoff                                                     | TOTP, passkeys and Enterprise SAML/OIDC complete and reviewed locally; signed MCP continuations and cross-site HTTPS SAML verified; live IdP/deployment acceptance pending |
| 6.11 Acceptance and rollout          | Feature contract tests and docs, staged enablement from 10% to 100% of workspaces                                                                                                                                                                                                | Recorded staging evidence for each feature, rollback exercised, external/manual gates recorded explicitly                                                                              | Pending                                                                                                                                                                                                                                                                |

Competitor CSV presets and bio email-signup are marked P6+ in their source
plans. They remain follow-up work unless explicitly brought into this phase.

## Implemented core key service

`packages/core/api-keys/service.ts` creates 24-character base62 secrets prefixed
with `sk_live_`, stores only SHA-256 of key plus pepper, returns safe paginated
views and rotates keys in a Mongo replica-set transaction. Restrictions accept
IPv4/IPv6 addresses and CIDRs. Authentication reads key and membership live,
so role changes, removed members and revocation apply on the next request.
The returned principal carries scopes and the current actor role. REST enforces
both before calling shared services and before replaying an idempotent response.
MCP integration remains pending. The workspace key list has a cursor index.

REST now reserves a Redis `apikey:last-used:{id}` flag for 60 seconds before
updating last-used timestamps. The conditional Mongo update remains a fallback
when Redis is unavailable. Authentication and membership checks still run live;
the throttle never caches authorization. Integration tests verify timestamp
suppression, subsequent updates and immediate revocation while throttled.

Settings → API keys now offers in-page creation, scope checkboxes, optional UTC
expiry/IP restrictions, one-time secret copying and dismissal, and inline
rotation/revocation confirmations. Owners and admins manage keys; other roles
see no key metadata. Disabled workspaces retain revocation access. The list uses
server-side cursor pagination with 25 keys per page and never sends hashes or
secret values in its initial props. English, Portuguese and Spanish use the
incumbent Settings controls and responsive layout.

The isolated sandbox starts with `bun --no-env-file apps/web/scripts/p6-dev.ts`.
It uses loopback Mongo/Redis, random credentials and separate ports 3200/3203;
Next development output lives inside `.next/p6`, preserving the P5 sandbox.
Run `bun run apps/web/e2e/api-keys.local.ts` against it. Credentials remain in a
private `/tmp/shortn-p6-login.json` file. Browser evidence lives in
`.impeccable/review/p6/`; it covers a 60+ key library, pagination, rejected creates
without writes, validation recovery, actual clipboard copying, secret dismissal,
read-only bearer usage, rotation/cancellation/revocation, feature/role gates and
390px bounds in all three locales. These are synthetic local fixtures.

Repeatable isolated checks:

```sh
MONGO_TEST_URL='mongodb://127.0.0.1:27020/?directConnection=true' bun test packages/core/api-keys
bun run --cwd packages/core typecheck
bun run --cwd packages/core lint
```

The integration suite requires loopback MongoDB and uses a unique temporary
database, which it drops afterward. Rotation requires a replica set.

## Initial REST implementation and remaining gates

Implemented: `GET/POST /v1/links`, `GET/PATCH/DELETE /v1/links/{id}`, `POST /v1/links/{id}/restore`,
`GET /v1/links/by-key/{domain}/{key}` (plus the query alias `/v1/links/by-key`), `GET /v1/workspace` and `GET /v1/workspace/usage` through shared
core services. Queries use bounded cursor pagination and searchable tag filters.
The same Zod route definitions generate `/openapi.json`; Scalar serves `/docs`.
Errors use `application/problem+json`. Only bearer keys authenticate; cookies do
not. Redis sliding windows emit rate headers, and the durable Redis instance
holds 24-hour idempotency records. Concurrent POST retries cannot create duplicate
links; a pending record survives uncertain completion and returns a conflict.
Workspace routes require `workspace:read`, report the current creator role and
resolved plan, and return ISO period boundaries with consumed/limit/remaining
counts. Unlimited limits and remaining counts are null. Link/QR counters cover
monthly creation; bio counters cover current pages, matching shared billing
semantics. Private workspace ownership and feature metadata are omitted. Scope,
viewer-read, tenant-isolation and revocation tests cover both routes.
Domain-qualified short-key lookup is workspace-scoped and supports legacy
root-domain links. It never reveals links owned by another workspace.
Campaign CRUD adds `GET/POST /v1/campaigns` and
`GET/PATCH/DELETE /v1/campaigns/{id}`. Shared core services retain plan gates,
UTM normalization and mutation authorization. Scope and current role are checked
before POST idempotency replay. The campaign list uses an indexed ID cursor,
bounded literal title search, and Mongo-computed link counts; link IDs never
enter the list response. A 1,001-campaign fixture with a 2,000-link campaign
verifies bounded payloads, disjoint pages, tenant isolation and literal search.
CRUD tests cover feature refusal, duplicate titles, idempotency, revoked scopes,
viewer reads, refused viewer mutations and non-destructive cross-tenant deletes.
These twenty-five routes are an initial subset of slice 6.2, which remains incomplete.
The remaining routes, expansions, generated client and full contract matrix are
still required.

Configuration defaults to disabled:

| Variable               | Behavior                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `PLATFORM_API_ENABLED` | `0` by default. `1` mounts REST and requires pepper and both Redis URLs.       |
| `PLATFORM_API_ROLLOUT` | Default `0`; deterministic workspace percentage from 0 through 100.            |
| `API_KEY_PEPPER`       | Distinct secret of at least 32 characters; rotation invalidates existing keys. |
| `LINK_DOMAIN`          | Default short-link domain, shared with other services.                         |

`workspaces.platformFeatures.api` explicitly enables or disables a workspace,
overriding its percentage cohort. The master mounting switch still applies.
Other optional workspace flags reserve gates for MCP, webhooks, bulk, link rules
and advanced authentication. Their feature consumers remain to be implemented.

IP restrictions currently use the direct socket peer. Forwarded IP headers are
not trusted. A verified proxy-origin integration is still required before
external client IP restrictions work behind the production tunnel/Caddy path.

Verification on 2026-10-12: all 15 workspace typecheck tasks, all 15 lint tasks,
and all 30 root test tasks passed (integration suites skip unless configured).
The explicit loopback Mongo/Redis run passed 28 tests across five files, including
concurrent key rotations, concurrent POST retries, role/scope and tenant checks,
key expiry/revocation, IP/CIDR rules, rollout cohorts, pagination, rate headers,
malformed inputs, idempotency retention and default-off environment validation.
No staging or production rollout gate is satisfied by these local checks.

```sh
MONGO_TEST_URL='mongodb://127.0.0.1:27020/?directConnection=true' REDIS_TEST_URL='redis://127.0.0.1:16380' bun test packages/core/api-keys packages/core/platform apps/api/src/rest.integration.test.ts packages/env
```

Next implementation work: complete the remaining REST/core
capabilities (bulk links, bio, webhooks, QR exports and expansions); then outgoing
events, MCP, generated docs, bulk jobs, rule evaluation and their rollout gates.

## Key settings completion checkpoint — 2026-10-12

The Impeccable reviewer requested one material recovery fix: clear field errors
on edit and supply specific Name, Permissions and IP guidance. The fix also
preserves checkbox state after failed submission by handling submission without
React form-action resets. The browser suite verifies all three rejected inputs
make no writes, errors clear on correction, and retry succeeds. The reviewer
scored that fix resolved (`ship` at fix scope), and documentation comparison
preserved the incumbent system. Detector findings were empty. Review and
capture evidence is in `.impeccable/review/p6/`.

The final local verification passes all 15 workspace typecheck tasks, all 15
lint tasks and all 30 test tasks, plus 36 explicitly configured Mongo/Redis/form
contract tests. The API-key browser lifecycle also passes in the isolated
sandbox. No staging deployment, production rollout, proxy-origin acceptance,
remaining REST capabilities, outgoing events, MCP, bulk jobs, link rules,
advanced QR or deferred account-authentication gates are established here.

## Link trash and restore checkpoint — 2026-10-12

Deleting a link now creates a 30-day tombstone. Normal workspace reads,
public password/safety/report flows, campaign link lists, QR attachment choices
and public bio resolution exclude it. Its settings, canonical key, previous
keys and campaign/bio references remain available for restoration. Canonical
and alias cache entries are invalidated, and affected public bios receive an
invalidation outbox job. Restore preserves password and safety gates and uses
the same creator-aware delete permission. Both operations reject more than
1,000 IDs; repeated deletion does not extend retention. Updates atomically
require an active link, preventing a concurrent PATCH from editing a tombstone.

The redirect service distinguishes deleted cache entries from ordinary missing
keys. Deleted canonical keys and aliases receive localized Shortn HTML with
HTTP 404, without a Location header or a click event. Existing missing-key
redirect behavior is preserved. The response is private, carries security
headers, and renders independently of the dashboard.

A worker job checks expired trash every minute, processing 100 links per pass
with an indexed date/ID query. It marks each link as purging before cleanup so
restore cannot race hard deletion. Cleanup archives legacy click counts,
detaches QR references, removes tenant-scoped legacy campaign/bio references
and invalidates keys before removing the tombstone. Failed cleanup is retryable;
aggregate analytics collections remain. Keys become reusable after purge.

Links → Trash reuses the main Links filters, table styling and 25-row server
pagination. Searchable tag filters, first-tag grouping of the current page,
restore deadlines, selection across pages/filters/reloads within a tab, and a
visible 1,000-link operation limit are available in English, Portuguese and
Spanish. Restoring is an in-page action; failed or expired selections remain
visible for recovery. No full link library is fetched into the browser.

`apps/web/e2e/link-trash.local.ts` uses the isolated P6 sandbox and a temporary
1,001-link fixture. It verifies bounded rows, disjoint pages, selection across
filters including an empty result, clear-filter scope preservation, reload
persistence, grouping, a two-link restore against MongoDB and 390px bounds in
all three locales. It deletes only its own fixtures afterward. Captures and
review records live beside API-key evidence in `.impeccable/review/p6/`.

The explicit link/core/redirect/REST run passed 48 tests with 396 assertions.
The wider P6 integration run passed 67 tests with 2,742 assertions before the
final UI additions. Root checks passed all 15 typecheck, 15 lint and 30 test
tasks. Staging/production acceptance remains pending. This completes only the
trash portion of 6.9; advanced rules, bulk workflows and styled QR output, plus
the remaining P6 slices above, still require implementation and verification.

## QR REST checkpoint — 2026-10-12

`GET/POST /v1/qr-codes` and `GET/PATCH/DELETE /v1/qr-codes/{id}` now use the
shared QR services. The list uses a bounded descending-ID cursor and searchable
literal title/destination/public-ID terms plus tag filters, with a workspace/ID
index. Its filter construction is shared with the existing numbered dashboard
pages. Responses preserve stored legacy design options and contain string IDs
and ISO dates. Bearer `qr:read`/`qr:write` or `qr:*` scopes intersect live roles;
POST idempotency replay observes current permissions. Attaching a QR to a link
also requires `links:write`, checked before replay, and applying QR changes to
its attached link requires the same scope. Trash cannot be attached and QR
updates do not edit trashed links. QR deletion retains its attached link.

The explicit QR service and REST contract run passed 21 tests and 278
assertions. Evidence includes a 1,001-QR fixture, disjoint bounded pages, literal
search and tag filters, quota rollback with no extra backing links, logo plan
gates, creator-based deletion, cross-workspace reads/mutations, scope/role
changes before replay and attachment/trash behavior. Styled SVG/PNG/PDF exports
remain pending; the five routes do not complete the QR API or phase 6.9.

Trash finish review scored both requested fixes (brand mark and bundled Geist)
resolved with disposition `ship` at that fix scope. The documenter compared the
extension with the incumbent system and preserved it. Root/custom browser-origin
checks rendered the actual Hono 404 response under its CSP, loaded the embedded
font and mark with no external asset request, and captured the localized views.

## Tags REST checkpoint — 2026-10-12

`GET/POST /v1/tags` and `GET/PATCH/DELETE /v1/tags/{id}` now enforce
`tags:read`/`tags:write` and live roles. Lists have bounded descending-ID cursor
pagination and literal search; merged records are excluded. Item routes accept
canonical Mongo IDs and legacy tag IDs/aliases, preserving references returned
by existing link and QR views. New explicit and implicit tags record their
creator. Members can delete their own tags; owners/admins can delete any.

Creation normalizes names and rejects case-insensitive duplicates. Rename and
removal update owned live/trashed link and QR references inside a replica-set
transaction, matching canonical IDs, legacy aliases and old name-only embedded
references. Unrelated resources are not rewritten. Deleting a tag retains its
links and QR codes. Scope/role checks precede POST idempotency replay.

The REST suite passed 16 tests with 259 assertions. Tag cases cover 1,001-link
and 1,001-tag libraries, disjoint bounded pages, literal search, legacy aliases,
creator permissions, tenant contamination isolation and duplicate refusal. An
intentional QR validation failure after the link update verifies that the tag
and every link reference roll back together. Concurrent tag edits during new
link/QR creation remain an acceptance case for the mutation/outbox foundation;
this checkpoint does not establish full P6 completion.

## Latest local verification — 2026-10-12

The combined explicit P6/core/redirect contract run passed 95 tests across 14
files with 2,976 assertions against isolated loopback MongoDB and Redis. Root
checks passed all 15 typecheck, 15 lint and 30 test tasks. The 1,001-link browser
flow passed in English, Portuguese and Spanish. `git diff --check` passed, and
`graft build` refreshed the graph. No staging or production deployment was made;
the full P6 gate and the outstanding slices in the table remain open.

## Analytics and domain REST checkpoint — 2026-10-13

`GET /v1/analytics` and `GET /v1/links/{id}/analytics` now use
`queryAnalytics` in `packages/core/analytics/service.ts`. The dashboard action
calls the same service, preserving its totals, previous-period comparison,
timezone-aware series, breakdowns, filter options and labels. Core validates
filter dimensions, link IDs, event kinds, timezone and date ordering; it applies
the plan retention window and breakdown gates. Requests reaching the existing
2,000-bucket cap are refused instead of returning a truncated series. Expired
ranges return no series. The QR scope's backing-link lookup is tenant-scoped.

Both REST routes require only `analytics:read`, including the per-link route;
`links:read` alone cannot read analytics. `from` and `to` are ISO timestamps;
`timezone`, `interval`, `groupBy`, `limit`, `link`, `kind` and named dimension
filters mirror the shared service. Breakdown rows are bounded to 1,000. As in
the dashboard, plan-gated breakdowns are listed in `gated`, and detailed filters
are applied only when the plan supports analytics breakdowns. API keys intersect
live memberships; viewers can read, cross-workspace links return 404, and revoked
keys stop immediately. Core and REST results are compared in the contract test.

`GET/POST /v1/domains`, `GET /v1/domains/{id}/status` and
`DELETE /v1/domains/{id}` wrap shared core domain services. Lists use an indexed
workspace/ID cursor, at most 200 rows, and literal hostname search. Status reads
expose verification records and ISO timestamps without provider IDs, add-on
subscription IDs or workspace ownership data. The existing dashboard domain
list shares the same safe view.

Domain creation requires `domains:write`, the live workspace owner, an active
paid domain add-on, and `DOMAIN_WRITES=1`. Both ownership and the operational
switch are checked before POST idempotency replay. Scope-only reader keys and
viewer creators can list/read status. Removal remains available when provisioning
is disabled, requires the owner, and delegates to the existing immediate disable
and asynchronous provider cleanup. No provider network call is made by a REST
handler. Contract fixtures cover 1,001 domains, disjoint pages, literal search,
reserved hostnames, invalid redirects, foreign bio references, duplicate hostname
refusal, add-on requirements, tenant boundaries, role changes, replay, removal
and revocation.

These six endpoints bring the REST subset to 31 routes. Bulk link mutations,
bio routes, outgoing webhook routes, styled QR exports, expansions and generated
client contracts remain required. The broader P6 checklist remains open; local
contracts do not establish staging, production or live provider acceptance.

Verification for this checkpoint: the explicitly configured loopback MongoDB/
Redis suite passed 84 tests across 12 files with 2,959 assertions, including the
P5 bio/domain publishing contracts. Repository checks passed all 15 typecheck,
15 lint and 30 test tasks (unconfigured integration suites skip in the root
run). `git diff --check` passed. No staging or production deployment, paid
provider request or rollout acceptance was performed.

## Bio REST and generated client checkpoint — 2026-10-13

`GET/POST /v1/bio-pages`, `GET/PATCH /v1/bio-pages/{id}` and
`POST /v1/bio-pages/{id}/publish` use shared core services. Lists use indexed
workspace/ID cursors, a legacy-owner cursor index, bounded literal title/handle
search and at most 200 summaries. Mongo computes link counts from draft blocks
or legacy references without returning drafts, published snapshots or link
arrays in list payloads. Item reads return the validated/migrated draft, current
revision, published revision and publication status.

`patchBioDraft` accepts an explicit revision and partial content. Blocks replace
the ordered list; theme and SEO merge supplied fields. Unspecified locale,
branding, SEO and theme values survive a partial patch. Shared validation retains
plan gates, accessible colors, block limits, safe URLs, live link ownership and
trash checks. Concurrent saves of one revision produce one success and one
conflict. Publishing uses the existing replica-set transaction for the snapshot,
version history and durable invalidation outbox. Neither saving nor creating
publishes implicitly.

Read routes require `bio:read`; mutation routes require `bio:write`, intersected
with the creator's live role. Viewer mutations and revoked scopes are checked
before POST idempotency replay. `bio:*` works across the resource. Cross-workspace
reads, patches and publication return 404. Creation now validates its shared
input and rejects inaccessible link attachments rather than silently discarding
them. Contract cases include a 1,001-page library, a 2,000-link legacy page,
legacy ownership without tenant contamination, unchanged publication on
rejected saves, revision conflicts, partial merges, quota refusal, premium plan
gates and immediate revocation. These five endpoints bring the subset to 36.

`bun run --cwd apps/api gen:contracts` generates `apps/api/openapi.json` and
`apps/api/client/schema.d.ts` from the Hono route registry. Infrastructure getters
throw if generation attempts database/cache access. The
[openapi-typescript Node API](https://openapi-ts.dev/node) validates/bundles the
schema through Redocly, then emits types formatted using the repository's
Prettier configuration. `check:contracts` regenerates in memory and rejects
drift. A deliberate alteration of the generated OpenAPI file was refused; the
original artifact was restored and a clean check passed.

`@shortn/api/client` exports a typed openapi-fetch client with bearer auth,
optional origin/fetch overrides, normal response headers and typed problem
responses. Compile examples include valid calls and rejected missing destination,
path parameter, analytics range and publication revision. Runtime tests cover
query serialization, credential placement, idempotency headers and RFC 9457
errors, and the bio contract uses the client against the actual Hono app. The
CI checks job now validates generated contracts before lint/typecheck/tests.
Client usage and regeneration instructions live in `apps/api/client/README.md`.

Bulk link routes, webhook routes, styled QR exports and expansions remain
required for REST completion. Docs mirrors, markdown routes, llms generation,
MCP, outgoing events, bulk jobs, link rules, advanced QR and account-authentication
work and staging/production acceptance remain open in the phase checklist.

Verification: 97 explicit loopback MongoDB/Redis/client contracts passed across
16 files with 3,144 assertions. All 15 repository typecheck tasks, 15 lint tasks
and 30 test tasks passed; unconfigured integration suites skip in the root run.
The P5 publishing fixture now allows 30 seconds for its many-index setup after
the five-second setup limit was reached during concurrent repository checks.
Test assertion timeouts remain unchanged. The generation drift check and
`git diff --check` pass. No staging deployment, production rollout or external
provider acceptance is established by these local checks.

## Outgoing webhook delivery foundation — 2026-10-13

Eight REST routes implement webhook CRUD, explicit tests, paginated delivery
logs and redelivery. They use shared core services and require webhook scopes
intersected with live owner/admin roles. Scope/role and feature checks precede
POST idempotency replay. Reads and deletion remain available for cleanup while
provisioning is disabled. New endpoints return a random signing secret; metadata
reads omit it. AES-256-GCM protects secrets in MongoDB and cached creation
responses. Cursor lists, literal name/URL search and 200-row limits are covered
by a 1,001-endpoint fixture. The generated spec/client now covers 44 operations.

The worker drains the Mongo delivery outbox through BullMQ on the durable Redis
connection. It leases attempts, signs timestamp/body HMACs, preserves event and
delivery identity across retries, records attempts without receiver response
bodies, backs off exponentially within 24 hours and reclaims expired leases.
Restart tests prove a failed delivery resumes without creating a new event.
Repeated completed jobs do not resend. The default sender validates all resolved
IPv4/IPv6 addresses, pins a public address for HTTPS, preserves certificate
hostname verification, refuses redirects and bounds DNS/request time.

After three days of unresolved failures, endpoint disablement and a notification
record commit together in a Mongo transaction. Delivery and attempt records have
30-day TTL indexes; list/redelivery reads also enforce expiry explicitly.
Worker sends recheck endpoint/workspace state and tenant ownership. Shutdown
waits for an active pump and worker before closing the queue connection.

Configuration defaults off: `PLATFORM_WEBHOOKS_ENABLED=0` and
`PLATFORM_WEBHOOKS_ROLLOUT=0`; workspace `platformFeatures.webhooks` overrides its
cohort. API/worker enablement requires a distinct `WEBHOOK_SECRET_KEY` of at least
32 characters and Redis URLs. The same key must remain available to API and
worker processes. Rotation requires re-encryption of existing records; no
rotation procedure or production gate is established here. Operations and
signature details are in [the webhook guide](../api/webhooks.md).

This checkpoint implements the delivery foundation and explicit `webhook.test`
production. Automatic core mutation events, click/scan batching, import-completion
production, failure-email delivery, in-page endpoint/log/redelivery management
and staging receiver acceptance remain required. Subscription names are reserved
in the API schema; they do not imply those producers are already connected.

The full explicitly configured MongoDB/cache Redis/durable Redis integration
run passed 190 tests across 32 files with 3,840 assertions. This includes the
previously skipped database/index safety gates, outgoing delivery restart and
queue-producer recovery, stale-attempt fencing and delivery-log expiry checks.
The index compatibility test now locates the bio handle index by name rather
than assuming it is first after cursor indexes were added. All 15 repository
typecheck tasks, 15 lint tasks and 30 root test tasks passed. Generated contracts,
frozen-lockfile installation and `git diff --check` also pass. Receiver calls
used a synthetic loopback fixture; no staging/provider request, production
activation or external email was performed.

## Atomic mutation events and failure email — 2026-10-13

Main core link create/update/trash/restore, managed bio publication and domain
verification now persist source events in the mutation transaction. Explicit
allowlists exclude passwords, safety reports and visitor information. Failed
source inserts roll back the mutation; repeated trash/restore, publication and
domain polling do not duplicate transition events. Link creation serializes quota
checks in its transaction, and link edits derive v2 fields from the current
transactional document to preserve concurrent password/destination edits and
rename history. Legacy click renaming remains workspace scoped.

The worker fans out source events using 100-recipient pages (bounded to 200),
transactional cursor advancement and unique automatic delivery identities. A
1,001-subscriber fixture verifies concurrent fanout and restart behavior without
loading the entire subscriber library. Existing send-time workspace gates apply.

After auto-disablement, a bounded notification worker emails the workspace owner
in English, Portuguese or Spanish. Leases prevent concurrent sends, failures
retry after five minutes, stable provider keys deduplicate retries, and a fresh
generation fences stale completion when an endpoint is disabled again. Provider
errors are stored as bounded codes. The mail allowlist is preserved and the email
links to the existing workspace settings route. No external email was sent.

Before the email addition, the full configured integration suite passed 197 tests
with 3,938 assertions, along with all root typecheck/lint/test tasks and contract
checks. Notification integration tests separately cover concurrent sends, retries,
lease recovery, missing owners and stale generations. The phase remains incomplete:
secondary link mutation producers, click/scan batching, import completion,
management UI and staging receiver acceptance are still required for phase 6.3;
the other pending phase rows remain unchanged.

After the email addition, the configured integration suite passes 200 tests
across 34 files with 3,953 assertions. All 15 root typecheck tasks, 15 lint tasks
and 30 test tasks pass, as do generated contract checks and `git diff --check`.
Email rendering tests cover all three locales and escaped endpoint names. The
context graph was refreshed with `graft build`.

## Durable click and scan batches — 2026-10-13

The analytics consumer now saves opted-in click/scan webhook receipts before
acknowledging the Redis entry. Stream IDs uniquely identify receipts; replay
recovers a failed receipt write even when analytics was already persisted.
Capture uses bounded 500-entry pages, resolves legacy workspace ownership, checks
QR ownership/backing identity and excludes bots and visitor data. Receipt writes
use majority write concern. Master/workspace rollout gates and explicit event
subscriptions apply.

The outgoing worker flushes per-workspace/type batches after 10 seconds or 100
receipts. A server-side grouping query finds due workspaces without a quiet group
hiding another workspace's full batch. Pumps process at most 20 batches and share
capacity between due groups. Transactional consumption and source-event creation
prevent duplicates under concurrent pumps and roll back together on failure.
Unprocessed receipts have no TTL; completed receipts keep deduplication identities
for 30 days. Payloads use an explicit bounded allowlist and contain no raw IP,
user-agent, query or referrer information. The existing durable delivery fanout,
signatures, retry behavior and send-time feature checks apply.

The actual redirect → Redis → analytics worker integration now checks automatic
click and scan batches, bot exclusion and legacy QR attribution. An injected
receipt validator failure proves XACK is withheld and replay recovers without
duplicate analytics or receipts. Focused Mongo tests exercise the exact 100-event
and ten-second boundaries, concurrent pumps/capture, a 2,001-event backlog, opt-in,
rollout, QR isolation and transactional batch rollback.

Verification after batching: the configured MongoDB/cache Redis/durable Redis
integration suite passes 206 tests across 35 files with 3,989 assertions. All
15 root typecheck tasks, 15 lint tasks and 30 test tasks pass, as do generated
contract checks and `git diff --check`. The context graph was refreshed. Secondary
link writers, import completion, webhook management UI and staging receiver
acceptance remain required; the other pending P6 rows remain unchanged.

## Campaign and QR mutation events — 2026-10-13

Campaign UTM replacement, rename and deletion now write link events together with
variant/campaign membership changes. A workspace mutation fence serializes title
creation and expected-state edits. Canonical link fields derive from the current
transactional document. Rename/deletion walk references with a 100-row cursor,
including legacy title-only references; they do not depend on a stale membership
array or alter foreign workspace references. Campaign IDs remain authoritative
when distinct campaigns have the same title. Cache invalidation runs after commit
using each changed link's actual domain and key.

QR creation now serializes quota checks before inserting the QR/backing pair,
with attachment updates and events in the same transaction. Editing reads fresh
QR and link documents, preserves unmodeled design fields, and emits updates only
for changed link fields. Explicit tag-only application updates attached links.
Stored link IDs preserve edits/detachment after rename; legacy key lookup remains
supported. Deletion commits QR/backing removal, attachment detachment, scan
archival and events together. Archival uses bounded 1,000-row upserts in the
transaction and excludes foreign workspace legacy clicks; default nontransactional
callers retain the existing merge-based archive path.

Focused integration coverage includes injected source-event failures for create,
edit, delete and scan archival; concurrent free QR quotas (five successes and
three refusals); stale expected-state UTM edits; foreign reference/membership
contamination; attachment rename; 1,001 legacy scans; and a campaign with 1,002
linked references. Tag changes, domain assignment and safety-state producers,
import completion and webhook management UI remain pending, alongside the other
unfinished P6 rows and staging/production acceptance gates.

Final verification for this checkpoint: 215 configured integration tests pass
across 36 files with 4,051 assertions. All 15 root typecheck tasks, 15 lint tasks
and 30 test tasks pass; generated contract checks and `git diff --check` also pass.
QR/campaign invalidation now clears both canonical and previous alias caches;
renamed-attachment and campaign alias fixtures verify that behavior. The context
graph was refreshed with `graft build`. P6 remains active and incomplete.

## Tag, domain and safety-state events — 2026-10-13

Tag rename/deletion now emits linked-resource updates inside the existing majority
snapshot transaction, covering live/trash links and canonical tag-ID references.
No-op names emit nothing. Event traversal uses a 100-row cursor and is skipped
when there is no enabled `link.updated` subscriber. The existing workspace-scoped
bulk reference updates remain in place.

Domain assignment fences the hostname document against removal/concurrent
assignments, rechecks TLS/hostname/add-on readiness in the transaction, checks
canonical and previous-key collisions and excludes trashed/foreign links. Link
updates, source events and related bio invalidation records commit together.
Domain removal also commits link disablement/bio detachment/events together;
recovery commits each successfully moved link with its event and retains conflicts.
Canonical and alias caches are invalidated on both affected hosts after commit.
Related published bio references are queued for refresh for all three operations.

Safety scanning now rereads the current link after the provider responds, discards
results for changed destinations and derives fields from that transactional
snapshot. This preserves concurrent password edits and report-triggered blocking.
State changes and events commit together; identical periodic rescans emit nothing.
Abuse report insertion, counter updates and threshold blocking are transactional.
Concurrent reporters serialize on the link, duplicate identities count once, and
only the transition into threshold blocking emits an event. Payloads retain the
existing metadata allowlist and expose no report details or visitor identities.

Focused fixtures exercise 1,002 tagged links including trash/canonical-only and
foreign references, no-op rename, source-insert rollback, domain alias collisions,
assignment/removal/recovery rollback, stale scan responses, concurrent password
edits, repeated scans, and simultaneous/duplicate abuse reports. Import-completion
production, webhook management UI and staging receiver acceptance remain pending,
as do the other unfinished P6 sections.

Verification for this checkpoint: 223 explicitly configured integration tests pass
across 37 files with 4,105 assertions. All 15 root typecheck tasks, 15 lint tasks
and 30 test tasks pass. Generated contract checks and `git diff --check` pass, and
the context graph was refreshed. Provider responses use injected local fixtures;
no external safety request, deployment, email or production activation occurred.
The full P6 objective remains active and incomplete.

## Webhook settings and delivery management — 2026-10-13

Workspace Settings → Webhooks now provides in-page endpoint creation/editing,
explicit event subscriptions, pause/enable, test requests, confirmed deletion and
one-time signing-secret display/copy. SSR lists use literal search and 25-row
cursor pagination. Endpoint delivery pages show the 30-day log, event identity,
attempts, status, bounded errors, refresh and redelivery, also in 25-row pages.
No sheet or full client-side library fetch was introduced. All operations use
shared core services through authenticated server actions; secrets are omitted
from list/detail props, and reads/deletion remain available when provisioning is
disabled. English, Portuguese and Spanish copy follows existing settings tokens,
Page/Section/form/button primitives and responsive row controls.

A loopback browser fixture verifies 1,001 endpoints while rendering only 25 rows,
creation/editing/deletion, one-time secret copying and absence on a fresh load,
explicit default event selection, test delivery persistence, paginated logs,
redelivery preserving the original event identity, pausing and pt/es 375px bounds.
The P6 local runner now enables webhooks only in its isolated sandbox; it starts
web/API processes and no outgoing delivery worker. All receiver URLs and delivery
rows in these UI tests are synthetic, and no destination request is sent.

UI review initially required settled capture evidence, then identified keyboard
focus restoration and confirmation-name wrapping. Both fixes passed browser
checks and the reviewer returned `disposition: ship` for those fixes. The capture
fixture now waits for fonts/motion and resets the app scroll surface. The
100-character deletion confirmation is verified at 375px; focus returns after
editor cancellation/save, secret dismissal, confirmation cancellation and deletion,
including through server refresh. The documenter confirmed incumbent primitives
and tokens; two removed radius utilities were replaced with `rounded-control`.
The pre-existing absence of DESIGN.md was preserved for this ordinary extension.

The configured integration suite still passes 223 tests with 4,105 assertions
across 37 files. Root checks and generated contract checks pass. The browser
fixture uses synthetic data and performs no outgoing receiver request. Import
completion and staging/production receiver acceptance remain unfinished for phase
6.3; the full P6 objective remains active with its other pending sections intact.

## Public developer documentation

`packages/docs` serves a shared, generated documentation bundle in the API and
web apps. The API retains Scalar at `/docs`; the web mirror is `/docs/api`.
The web `/docs` index links getting-started, webhook and MCP status guides, each
with an identical `.md` route. MCP setup is explicitly unavailable until 6.4.
Both services expose `/llms.txt`, `/llms-full.txt` and `/openapi.json`, including
when REST rollout is disabled. Generation uses live registered OpenAPI routes,
includes every operation and shared schema, and supports Markdown or the portable
Markdown subset of MDX. `bun run gen:llms` refreshes the checked-in bundle;
`bun run check:llms` regenerates and rejects drift in CI without credentials or
infrastructure. The web mirror targets the staging API when `PUBLIC_ORIGIN` is
`https://staging.shortn.at`; the production mirror targets `api.shortn.at`.

REST CORS permits explicit bearer requests and exposes rate-limit/retry headers
without cookie credentials, allowing Scalar requests directly to the API.
The edge forwards docs, OpenAPI, llms and robots paths to web even when redirect
rollout is zero. Documentation keys are reserved. The crawler policy allows
public docs and marketing while bio pages retain their own noindex metadata.
Local tests cover every index/internal guide link, every operation and schema,
API disabled mode, staging reference targets, CORS and unauthenticated rejection,
and edge routing. `apps/web/e2e/docs.local.ts` verifies public Next routes,
mobile guide bounds and the loaded Scalar interface. Staging delivery remains
an acceptance gate rather than an implied result of local tests.

Verification for this slice: all 48 repository lint/typecheck/test tasks passed;
the real Mongo/Redis API suite passed 29 tests and 531 assertions. The local
browser check passed, and both contract and documentation drift checks passed.

## Link metadata expansions

REST link lists and all three individual lookup forms accept `expand=tags,campaign`.
`expanded.tags` and `expanded.campaign` contain full resource metadata in arrays,
without changing the default compact response. The matching read scope is required
for each requested expansion. Unsupported names are rejected. Shared core joins
at most 200 links, batch their referenced records inside workspace ownership, and
preserve legacy aliases and title-only campaigns while preferring stable IDs.
Unresolvable or foreign references are omitted and repeated variants deduplicated.
Campaign link counts are computed in Mongo instead of loading full link arrays.

The real Mongo/Redis contract test reads 201 links across two pages, expands a
campaign with 1,001 link IDs, and verifies all lookup routes, compact defaults,
missing scopes, invalid expansions, legacy documents, renamed/deleted/merged
references, duplicate variants, and foreign ownership despite matching legacy sub.

Expansion verification: all 48 repository lint/typecheck/test tasks passed, and
the real Mongo/Redis API suite passed 30 tests with 1,758 assertions. Generated
OpenAPI/client and documentation drift checks passed.

## Atomic bulk link creation

`POST /v1/links/bulk` accepts 1–1,000 creation inputs inside the existing 1 MiB
request limit, uses live key/role/feature checks and POST idempotency, and returns
ordered items with a count. Shared `links.createMany` validates the whole batch,
checks full quota under the workspace mutation lock, rechecks keys in the
transaction, and commits links, tags and per-link webhook events together. Single
link creation uses the same path. Failure creates no partial links or orphan tags.
Optional problem `context` includes a zero-based row index or exact quota numbers.
Tag resolution supports assigned and unassigned legacy records while excluding
records explicitly assigned to another workspace. Tags are now session-aware.

Local tests exercise the full 1,000-link limit with events, tags and legacy hashes;
invalid rows, duplicate keys, reserved keys, roles, free-plan quota refusal,
concurrent single/bulk requests, racing batches sharing a key, and rollback on an
outbox failure after an earlier row/event was written. REST tests cover envelope
bounds, scopes, ordered results, retries/conflicts and feature disablement before
replay. CSV import orchestration and its whole-import reservation remain pending.

Bulk verification: the broad integration suite passed 232 tests. After the final
legacy-tag adjustment, all 160 core/API/worker integration tests passed with
8,739 assertions; all 48 repository lint/typecheck/test tasks and both generated
contract/documentation drift checks passed. The 1,000-link transaction completed
in approximately 2.4 seconds on the local fixture; this is not staging import
throughput evidence.

## Schedule, expiry and query rules

REST and shared core link creation (including bulk) and editing accept validated
`rules`. Dates are stored as Mongo dates and compiled to epoch timestamps in the
minimal cache projection. Activation is inclusive and expiry exclusive; every
cached decision checks time without another database or Redis lookup. Safety and
password gates remain first. Time gates return localized branded 404/410 pages
or an untracked 302 fallback. This reuses the redirect's existing standalone
branded unavailable-page renderer.

Forwarded query parameters preserve destination precedence and repeated incoming
values, omit Shortn control/attribution parameters, and enforce count/size bounds.
Fixed UTM values take precedence and are reflected in click events. Permanent
final hops use 301 while retaining click enqueueing and private cache headers.
Rules replace as a unit; `null` clears them, with normal mutation events and cache
invalidation. Scans include fallback destinations, retain the worst verdict, and
reject results if either destination changes during the provider lookup.

Golden and HTTP tests cover exact boundaries on one cached payload, token/gate
precedence, fallback behavior, query conflicts/reserved keys/duplicates/bounds,
permanent-click recording, ISO/date/epoch round trips, invalid chronology and
private fallbacks, replacing/clearing and workspace isolation. Stubbed provider
integration tests cover malicious fallback verdicts and fallback-change races.

The worker currently has no automatic safety scan path for REST-created links;
this gap was identified while tracing fallback safety and is now explicit in the
API docs. Worker scan scheduling, delayed invalidation, targeting, rotation, deep
links, max-clicks, social preview responses, health checks and the advanced
in-page editor remain requirements, not inferred from these passing tests.

Rule verification: the broad suite passed 243 tests with 9,570 assertions; the
final focused rule/safety suite passed nine tests with 146 assertions. All 48
repository lint/typecheck/test tasks, contract and docs drift checks passed.
Local Chromium verified scheduled/expired 375px pages in English, Spanish and
Portuguese; captures are in `.impeccable/review/p6-rule-gates/`.

## Durable safety scans

New links (including REST and bulk) and QR backing links now commit a versioned
scan request in the same Mongo mutation. Destination and fallback edits supersede
older requests. `apps/worker/src/safety-scans.ts` pumps bounded indexed pages into
BullMQ on durable Redis. Pending older links without requests are recovered in
pages of 50; trash is excluded. Mongo remains authoritative if queue publication
fails or Redis loses a job. Two consumers execute scans concurrently, with atomic
120-second leases and generation/token fencing both at claim and verdict apply.
A crashed worker's expired lease can be reclaimed. An older job cannot apply a
verdict or reschedule a newer request, including when a provider returns late.

Success schedules the next scan seven days later. Exceptions, stale targets and
configured Web Risk outages retry with exponential backoff from five seconds to
one hour; stored errors are bounded codes. A structural verdict may still protect
the link while reputation is unavailable. `WEB_RISK_API_KEY` is now accepted by
the worker; without it structural/domain-age checks remain available. Existing
moderation blocks, password state, transactional events and cache invalidation
continue through the shared scan service. Shutdown drains current jobs and closes
queue connections.

Real Mongo/Redis/BullMQ tests cover duplicate claims, failures and retries,
destination generations, expired leases, a late malicious provider result after
lease replacement, configured reputation outage, bounded 102-link pumping and
queue restart, and recovery of pending legacy links while excluding trash.
This supersedes the scan-scheduling gap recorded in the preceding checkpoint;
remaining rule features and staging acceptance are still required.

Safety scheduling verification: the broad integration suite passed 250 tests
with 9,599 assertions. All eight final real-service safety-job tests passed,
including queue restart and late-provider fencing. All 48 repository lint,
typecheck and test tasks, contract/docs drift checks and diff checks passed.

## Device/geo targeting and branch analytics

The cached evaluator now selects the first matching device rule before the first
matching country rule, after all existing safety/password/time gates. REST link
creation, bulk creation and editing accept up to ten rules in each list. An OS
and device predicate in one rule are conjunctive. Supported OS and device values
are validated; country predicates use uppercase two-letter codes. Device parsing
runs only when device rules exist, and targeting adds no database/Redis lookups.
Prototype stored geo/device shapes are normalized on cache fill.

All target destinations use the normal structural URL checks and enter the scan
destination set. A changed set resets safety to pending without clearing blocks,
persists a new scan generation, and fences older provider results. Scans process
four destinations at a time; worker leases are now two minutes to accommodate
the maximum 22 distinct destinations plus database/cache work.

Selected branches travel through the click message, normalized `m.branch`, and
`byBranch` rollups. REST analytics exposes a plan-gated branch breakdown and filter.
Legacy links without targeting retain the prior message shape. Golden tests cover
OS/device conjunction, first-match precedence, default routing and safety/password
gates. The real-service pipeline verifies cache reuse (including L2), selected
locations with effective UTM, spoofed query branch isolation, stream encoding,
redelivery deduplication, normalized storage, rollups and REST branch analytics.
Core safety tests scan a malicious target that was not the default destination
and verify a target edit supersedes the scan request without re-enabling a block.
The dashboard branch view and other remaining rule/editor features remain pending.

Targeting verification: all 256 integration tests passed with 9,648 assertions,
and all 48 repository lint/typecheck/test tasks passed. Generated OpenAPI/client
and documentation drift checks and diff checks passed. Staging acceptance and
the remaining rule/editor requirements remain outstanding.

## Sticky weighted rotation

REST/core link rules now accept one to ten rotation options with positive finite
relative weights capped at 1,000,000. Rotation runs after safety/password/time and
device/geo rules, with query/UTM/permanent settings applied to the selected URL.
The compiled cache includes a SHA-256 configuration fingerprint, omitted from API
views. An absent or invalid cookie causes a cryptographically random weighted
selection. A valid `_sr_{linkId}` cookie reuses the option without another draw.
The host-only cookie is Secure, HttpOnly, SameSite=Lax, expires after an hour, and
is not refreshed on hits. It contains only a bucket and configuration fingerprint.
URLs, weights or order changes invalidate old selections. Gates and higher-priority
target matches do not set a rotation cookie.

Rotation destinations join the scan set; weight-only changes preserve scan
requests. The maximum scan set is now 32 unique destinations, processed four at a
time within the two-minute worker lease. `rotation:N` branches pass through stream
validation, normalized events, deduplicated ingest and `byBranch` rollups.

Deterministic tests cover weighted boundaries, sticky hits without RNG, malformed
and stale cookies, validation, old stored shapes, API view redaction, gate/target
precedence and effective query/UTM. HTTP tests verify cookie attributes and no
refresh. Real Mongo/Redis tests verify sticky redirects, branch ingest/rollups,
scan coverage and generation changes. `apps/web/e2e/rotation.local.ts` uses a
throwaway loopback HTTPS certificate and local DNS mappings to verify Chromium
accepts the cookie across actual cross-site redirects, preserves expiry, and
reassigns after changed weights. It deletes its certificate and key on exit.

Rotation verification: the broad real-service suite passed 262 tests with 9,707
assertions. The final rule/redirect suite passed 26 tests with 276 assertions,
including empty prototype rotation compatibility. All 48 repository lint,
typecheck and test tasks, contract/docs drift checks and the loopback Chromium
HTTPS cookie check passed. Staging acceptance and remaining P6 items are pending.

## Durable rule boundary invalidation

Link creation and bulk creation commit a versioned `ruleSchedule` with temporal
rules. Replacing or clearing rules supersedes the previous generation atomically.
`apps/worker/src/rule-schedules.ts` publishes up to 100 upcoming boundaries per
pump into BullMQ delayed jobs, with a one-hour lookahead and a one-second pump.
Jobs use one absolute timestamp for their delay calculation, preserve canonical
and alias invalidation, and advance to the next boundary only after Redis DEL
and invalidation publication succeed. Completed generation markers prevent older
schedules from being seeded repeatedly.

Mongo is authoritative. Unpublished and published/recovery paths have separate
indexes; recovery checks existing Redis jobs so healthy delayed work does not
consume new-publication capacity. Job IDs include generation, boundary and attempt.
Expired Mongo leases can be reclaimed independently of an older execution, and
checkpoint writes are fenced by generation/token. Cache failures retain retryable
work with bounded exponential backoff (one second to one minute); only bounded
error codes are stored. Lost queue entries are recovered on publication checks.
Earlier pending metadata and prototype Date fields are recovered in bounded pages.
The redirect still checks timestamps on every cache hit, independently of job
execution or infrastructure availability.

Change-stream invalidation ignores updates containing only `ruleSchedule` or
`safetyScan` bookkeeping fields, even without pre-images. Actual destination,
rule, safety and other mutations retain the previous invalidation behavior. This
keeps queue leases, publication markers and checkpoints from evicting payloads
before their boundary. Worker shutdown drains and closes the new queue.

Real Mongo/Redis/BullMQ tests cover both boundaries, no early processing, L2
canonical/alias eviction plus L1 pub/sub eviction, stale generations and clearing,
cache retries, expired-lease fencing, a shared deadline across 1,001 links,
publication/recovery fairness, queue restart/loss and legacy completion recovery.
Rule editor work, remaining redirect features and staging acceptance are pending.

Boundary-job verification: the broad real-service suite passed 269 tests with
9,749 assertions. The final scheduler/invalidator suite passed ten tests with
45 assertions, including the 1,001-link deadline and legacy recovery after the
final rules-snapshot guard. All 48 repository lint/typecheck/test tasks and
contract/docs drift checks passed. Staging acceptance and other P6 items remain
pending.

Maximum-click limits now accept a bounded nonnegative integer through shared
create/bulk/update rules. Limited redirects read a durable Redis counter after
safety/password/time gates. Historical click/scan totals seed it by maximum,
without adding overlapping aggregates. Tracked non-bot final hops increment the
counter in the same Lua script as XADD; failed appends spool the count metadata
for replay. Missing-QR legacy hops count without creating analytics. Bots and
gate/fallback responses do not increment. Counters have no idle expiry, so
untracked legacy QR visits retain their count. Tracked links reseed from persisted
totals after counter loss. This is approximate under concurrency,
spooling and persistence lag. Counter failures return retryable 503 for limited
destinations. Zero immediately closes a link. Reached limits return localized
410 or an untracked fallback 302. Advanced UI remains pending and must say “about”.

Maximum-click verification: 262 real-service tests passed with 9,571 assertions;
all 48 repository lint/typecheck/test tasks and generated contract/docs drift
checks passed. Chromium checks passed at 375px for scheduled, expired and limit
pages in English, Spanish and Portuguese. Counter tests cover historical seeding,
no idle expiry, failed stream append, shared QR counting, bots, fallback gates,
missing-QR counting without analytics, and spooled replay. This completes the
local maximum-click implementation; the advanced editor and other P6 items
remain pending.

Deep links now flow through shared create/bulk/update rules and cached compiled
payloads. Matching iOS/Android visitors select the app branch before device/geo
and rotation, after every safety/password/time/count gate. Public HTTPS app URLs
and explicit Apple/Google store fallbacks enter safety scans. Custom app targets
use an explicit scheme allowlist; arbitrary system or executable handlers are
rejected. Web fallback uses the main destination. The localized nonce-protected
handoff attempts app navigation, offers real app/fallback links without JS,
and falls back after 1.8 seconds only while visible. Hidden/pagehide/blur cancel
the timer; manual retry starts a fresh timer. Branches deep:ios/deep:android
measure one handoff click/scan, without claiming successful native launch.
Installed-app/native browser acceptance remains an external device check;
advanced editing, social previews and health jobs remain pending.

Deep-link verification: 267 real-service tests passed with 9,652 assertions,
including API round trips, HTTP safety-target scans, cached handoffs and branch
replay/filter/rollup behavior. All 48 repository lint/typecheck/test tasks and
generated contract/docs checks passed. Chromium passed 24 en/es/pt × web/store
× light/dark × mobile/desktop captures plus delayed fallback, hidden cancellation,
manual retry, no-JavaScript recovery and single-event checks. The fresh public-page
finish review returned ship with no material fixes; ordinary-extension documentation
is in `.impeccable/review/p6-deep-links/documentation.md`. Native installed-app
acceptance, advanced editing and the other P6 deliverables remain pending.

Social-preview overrides now flow through top-level og on shared core/API
create, bulk and update mutations, cached projections and link reads. Strict
bounded text/image validation rejects private or credential-bearing images.
Known preview UAs receive escaped OG/Twitter HTML plus meta refresh after all
gates; humans and search bots retain normal redirects. Preview responses never
open native apps or set rotation cookies. Their stream messages are marked bot,
so the ingestion path keeps them out of human analytics, webhooks and hot counts.
The canonical URL excludes request query values. Metadata and general link edits
now invalidate every historical alias as well as the canonical and renamed keys.
The public redirect does no metadata/image network fetch. Destination health,
advanced UI and the other P6 deliverables remain pending.

Social-preview verification: the broad real-service suite passed 274 tests with
9,787 assertions. After guarding malformed URL refinements, the final API/core
validation suite passed 32 tests with 1,779 assertions; malformed image/store
URLs return validation errors rather than parser exceptions. All 48 repository
lint/typecheck/test tasks and generated contract/docs drift checks passed.
Chromium checked decoded metadata, script-injection resistance, no image fetch,
exact meta-refresh navigation for apostrophes/semicolons/signed queries/fragments,
and human redirects. The real stream/worker test confirms a preview bot is counted
as a bot while human analytics and click webhooks retain their existing totals.
Destination health, advanced editing and other P6 items remain pending.

Destination-health backend implementation: link and QR creation persist versioned
health requests, destination-set edits supersede them, and legacy links backfill
in batches of fifty. A durable BullMQ producer publishes at most fifty due jobs
per pass; each fenced sixty-second lease checks one of at most 36 HTTP targets.
One completed cycle schedules the next for a week later. Redis host reservations
limit requests across worker instances, with bounded waiting and retryable
infrastructure/rate deferrals that preserve the cursor. DNS is resolved before
reservation and pinned to validated public addresses for each HTTP(S) hop.
HEAD uses GET fallback on 405/501; responses close at headers, redirects cap at
three, and a total probe deadline bounds network work. HTTP error streaks flag
after two observations and clear on recovery; unknown/blocked checks remain
informational. Results are read-only on Link API views and absent from redirect
caches. Health-only CDC writes do not evict cached redirects. The existing webhook
transport now also explicitly rejects its timeout promise after the health test
exposed Bun's request-destroy error behavior. Dashboard health flags remain pending.

Destination-health backend verification: 286 real-service tests passed with
9,880 assertions, including 1,001-link bounded backfill and lost-queue recovery,
HTTP streak/recovery semantics, stale/lease fencing, read-only tenant-scoped API
results, and shared host reservations. Transport tests use loopback fixture
servers and injected public DNS results; they verify private/mixed DNS rejection,
HEAD/GET fallback, response-header-only handling, explicit timeout rejection,
and the actual Bun socket's all-address DNS callback. The shared pinned lookup
adapter now supports single- and all-address forms for health and webhooks.
All 48 repository lint/typecheck/test tasks and contract/docs drift checks passed;
the graph was refreshed. Dashboard health flags and the other P6 deliverables
remain pending.

## Destination-health dashboard and large-library selection — 2026-10-14

This supersedes earlier notes that dashboard health flags were pending. Active
link rows now flag repeated HTTP errors and open an in-page Destination health
section on the existing overview. Per-target HTTP status, dates and observed
error streaks remain distinct from unreachable, blocked, pending and partial
results. The UI hides stale results and never changes redirect behavior.

The shared Links/QR selector now preserves selection across pages and filters,
including empty filtered pages, with an explicit 500-item limit and count.
Compact review transport fits below an 8 KiB request target for 500 IDs; existing
review permissions remain authoritative. Browser storage write failures use an
in-memory fallback. Other planned bulk operations remain pending.

Local browser evidence uses 1,001 synthetic links with 25-row server pages, tag
filters, a 500-ID review and limit rejection, plus 30 QR codes in grid/list views.
The 37 captures cover health states, en/es/pt, light/dark and 390/1440 widths,
plus shared selection controls. Keyboard navigation/disclosure, cross-page and
cross-filter selection, compact review/cancel, readable-storage/write-failure
selection and mobile overflow checks pass. Codec tests cover malformed input
and transport bounds. Root lint, typecheck and tests pass all 48 tasks.

Evidence is in `.impeccable/review/p6-health-ui/`. P6 remains incomplete: the
per-host reputation/RDAP cache required by specification 09 is still pending,
as are external/native acceptance and the other open slices in the table.

## Shared safety-provider cache — 2026-10-14

This supersedes the preceding per-host reputation/RDAP cache gap. Safety scans
now share Redis registration metadata by destination host for 24 hours. The
cache stores registration timestamps, so age advances across the 30-day signal
boundary without waiting for expiry. Structural URL checks still run per URL.

Web Risk matches are cached by exact URL within the host namespace until the
provider's absolute `expireTime`, following Google's
[Lookup API cache protocol](https://docs.cloud.google.com/web-risk/docs/caching).
A clean path never establishes trust for another path or hostname; clean Lookup
responses have no invented negative TTL. API-key digests isolate provider
configurations. Keys contain digests rather than destination URLs, hosts or
credentials, and values contain only registration timestamps or threat types.
Unavailable or malformed cache data falls through to the provider; failed
provider calls are not cached and retain the durable worker's retry behavior.
Concurrent lookups in one process share pending work; separate workers share
completed Redis entries.

Six focused tests cover path isolation, positive-match expiry, API-key rotation,
registration-age progression/expiry, outages, corrupt data and request
coalescing. The nine-test worker suite passes with real loopback Redis/Mongo,
including a new cross-client cache test checking actual TTLs, expiry refetch,
shared host registration and independent clean-path verdicts. Existing rule and
webhook-state integration callers are checked separately. P6 remains active;
external/native acceptance and all other open slices still require completion.

## MCP SDK transport and API-key tool service — 2026-10-14

The API now mounts the official TypeScript SDK's stateless Streamable HTTP
transport behind `PLATFORM_MCP_ENABLED`, the independent workspace MCP cohort,
and canonical-origin validation. API keys reuse live membership/role, expiry,
IP and revocation checks; rate budgets share the REST key namespace. Actual
request bytes are bounded and buffered before asynchronous authentication so
Bun's incoming network body remains readable by the SDK. JSON/protocol/header
validation stays in the SDK. No session cookie or unverified client name grants
access or sets audit identity. OAuth consent is still pending.

Eleven planned tool handlers, two resources and two prompts are registered.
Scopes are checked before dispatch, core services retain tenant/role/quota
checks, and lists use bounded cursor pagination. Core analytics now supports
tag scopes; link searches can filter campaign membership. `add_bio_link`
creates and attaches in one transaction: full/missing pages roll back links
and webhook events, and concurrent appends cannot lose items or exceed
100 entries. Published bio snapshots still require explicit publication.

MCP mutations insert durable `audit_log` intent before dispatch with the real
user, credential and `mcp:api-key:{keyId}` actor. An unavailable audit insert
prevents mutation. Completion-write failure retains intent and the successful
response for reconciliation without inviting a duplicate operation. Arguments,
URLs and secrets are not logged. Audit records have a workspace cursor index.

Local SDK integration covers every tool and resource, missing/conditional scopes,
workspace isolation, role/member changes, revocation/expiry/IP rules, rate
limits, origin/body limits, cursor search, tag analytics, concurrent bio-capacity
races and audit outages. MCP Inspector 2.11.0 connects over a real loopback
HTTP socket and passes tool/resource/prompt discovery plus `get_usage`. The
Inspector fixture uses temporary synthetic credentials, drops its isolated
database and deletes its own Redis rate/last-use keys after the run. Existing
REST, bulk creation, link service and bio publishing integration suites pass
after the shared-core changes. Client setup formats are documented from their
official references; manual client and staging acceptance are not claimed.

`create_qr_code` stores style but deliberately returns `exportUrl: null` and
`exportStatus: pending_styled_export` until the required QR artifact/export
service is implemented. OAuth workspace consent, Claude Desktop flow, styled QR
export delivery and staging tool acceptance remain open. P6 is not complete.

Final local evidence for this slice: 14 MCP integration tests / 89 assertions
pass; the earlier combined REST/core/MCP regression run passed 57 tests / 5,987
assertions. Inspector passes four discovery/call checks over loopback HTTP.
Root lint/typecheck/tests pass all 48 tasks, generated API contracts and llms
docs are current, and `graft build` completes. TLS termination preserves the
public Host check; an untrusted forwarded Host cannot bypass it.

## MCP OAuth provider and live token validation — 2026-10-14

The standalone Better Auth OAuth provider 1.4.18 is compatible with the existing
auth library. It is available through opt-in `AuthConfig.mcp`, without changing
the default deployed auth flow. It uses S256 PKCE, authorization-code/refresh
grants, hashed refresh storage, ten-minute access tokens, a single configured
MCP resource and workspace-specific consent references. Session storage remains
in Mongo. Dynamic public clients cannot skip consent or disable PKCE; client
management privileges are not delegated to registering clients.

An authenticated workspace-selection endpoint checks current membership and
MCP rollout. Consent approval names the workspace reviewed by the user, preventing
a changed selection from silently granting another workspace. Denial does not
require an available workspace. Scope escalation and modified signed queries
are rejected by the provider. Requests for another resource are refused before
issuance; no client-credentials grant is enabled.

Core validation checks signed JWT issuer, audience, expiry, user/session/client
and the consented workspace. It then reads live client, consent scopes, session,
membership and workspace state. Client disablement, consent withdrawal, logout
and membership removal invalidate use immediately. Role changes apply to the
next request. Rate identity is stable across refresh; audit identity comes from
the verified OAuth client, rather than initialization metadata.

The MCP app accepts an optional OAuth verifier/issuer configuration, advertises
protected-resource metadata and challenges alongside existing API-key access.
The default API-key path remains independently usable. Provider collection
models use the audited physical-name map and have grant/client/expiry indexes.

Seven real-provider integration tests pass with loopback Mongo: PKCE issue and
validation, consent selection/tampering/denial, resource/client/redirect binding,
one-time codes, refresh rotation/replay, live grant/session/client/membership
changes, wrong issuer/audience/signature and expiry. The MCP endpoint suite
passes 15 tests, including protected-resource discovery, API-key coexistence
and verified client audit identity. A pre-existing safety-cache expiry test now
freezes time before its first lookup, eliminating a millisecond timing race.

This is backend progress, not completed browser OAuth: authorization-server
discovery routing, web deployment configuration, workspace/consent pages, login
continuation, browser review and client/staging acceptance remain pending. The
provider's discovery warning is intentionally retained until that route exists.
Styled QR export delivery and all other open P6 slices also remain pending.


## MCP browser OAuth and discovery — 2026-10-14

The opt-in provider now has localized workspace selection and consent pages at
`/auth/mcp/workspace` and `/auth/mcp/consent`, preserving the existing auth frame,
controls and light/dark tokens. Email and username sign-in resume the signed
request. Users review app identity, workspace, role, requested permissions and
callback origin, with the full address in a keyboard-accessible disclosure.
Cancel works without a workspace selection; stale workspace reviews fail with
an in-page error. Invalid or expired requests expose no approval action.

Signed request previews verify the provider HMAC, expiry, duplicate parameters,
registered callback and live client status before displaying client details.
Web/API environment validation and edge routing expose authorization-server and
protected-resource discovery only when configured. OAuth remains disabled by
default; production origins require HTTPS.

Loopback browser evidence covers email and username continuation, workspace
selection, consent, PKCE exchange and an actual authenticated MCP `get_usage`.
Cancellation and stale approval rejection pass. Keyboard disclosure, primary submission and empty-workspace cancellation also
pass. The 28 captures in
`.impeccable/review/p6-oauth/` include English, Spanish and Portuguese, both
themes, 1440/390 widths, long names/addresses and invalid/error states. Provider
integration passes seven tests with 114 assertions, including signed-preview
rejection. Root lint/typecheck/test checks pass all 48 tasks. Styled QR export,
manual native-client acceptance and staging rollout remain open. The fresh
Impeccable reviewer returned `ship` for the 28-capture auth extension; evidence
and the five-section review are saved alongside the captures.


## Styled QR renderer foundation — 2026-10-14

`packages/qr-render` now produces SVG, PNG and PDF artifacts without native
canvas. The in-memory SVG tree applies the stored dot/finder styles and
linear/radial gradients, embedding only supplied bounded PNG logos. Figure
geometry retains the upstream MIT notice. PNG conversion uses the WebAssembly
resvg package; PDF pages preserve a 300 dpi physical size and deterministic
metadata. A versioned SHA-256 artifact identity includes rendered design, size,
logo bytes and output format, ready for the R2 cache.

The renderer preserves qr-code-styling's single-segment encoding and mask choice
while generating its matrix through qrcode. Exhaustive module comparisons cover
numeric/alphanumeric/byte data, long keys, legacy byte data and all four error
correction levels. Print plans enforce four quiet modules, Q correction minimum
and H for logos, opaque canonical sRGB colors and at least 3:1 contrast, including
gradient luminance ranges and finder colors. Size/data/gradient/logo limits reject
invalid designs before conversion. Minimum print guidance assumes four printer
pixels per module at 300 dpi.

Ten renderer tests pass with 169 assertions, including decoding actual PNGs for
all 36 combinations of six dot/finder styles, a gradient/logo code, deterministic
artifact identity and physical PDF dimensions. The standalone Chromium parity
fixture compares 39 corrected print designs against qr-code-styling 1.9.2 at
1024 px; every comparison changes fewer than 1% of pixels (maximum 0.9622%,
channel difference threshold 16). The report is saved at
`.impeccable/review/p6-qr-export/parity.json`.

This is a renderer foundation. It is not mounted in the application yet. Worker
jobs, R2 cache/storage, private delivery URLs, REST/MCP export contracts,
print-safe editor preview/guidance and bulk ZIP remain to implement. Circular
legacy designs and frame/caption treatment also remain; unsupported circle
exports currently fail explicitly rather than losing their design.


## Private QR export jobs and worker — 2026-10-15

Core now creates deduplicated, workspace-scoped QR export requests with an
immutable design snapshot and a 24-hour expiry. Jobs persist in Mongo before
queueing, with unique request, due-work, workspace and expiry indexes. The
private polling/delivery service rechecks current membership and the QR resource,
returns no design or object key, and signs completed delivery only for the
remaining job lifetime. Cross-workspace job IDs disclose nothing.

The BullMQ worker uses the existing durable Redis instance and a Mongo outbox
pump. It claims work with a fenced lease, reclaims expired leases, retries
transient storage failures with bounded backoff and fails invalid designs or
removed access permanently. It rechecks membership/resource liveness before
storing and completing. Queue interruptions leave recoverable Mongo work.
Private object keys include the workspace and renderer design hash. Cache hits
skip PNG/PDF conversion and reuse the existing artifact.

`packages/storage` supplies bounded, timeout-protected S3 reads, private writes
and attachment download signatures capped at 24 hours. Logo loading accepts only
configured app/public origins with validated stored upload paths; credentials,
query strings, fragments, encoded separators and normalized traversal fail.
The worker reads the upload object directly, never fetches arbitrary logo URLs,
and embeds only bounded PNG data. Raw internal failures and storage details do
not enter public job errors.

Worker startup is gated by `QR_EXPORTS_ENABLED=1`, default off. Enabled workers
require all five S3 variables and `APP_URL`; production storage and logo origins
require HTTPS. Existing queue startup/shutdown and timer patterns are retained.
The generated root environment example includes the new flag.

Five integration tests use isolated loopback Mongo/Redis, covering concurrent
deduplication, tenant isolation, snapshots, private cache, authorized signed
delivery, retry, permanent failure, removed members, deleted resources, rejected
logo URLs, expired leases/jobs and actual outbox-to-worker processing. Two
storage tests exercise the real AWS SDK against a synthetic loopback server,
including bounded streaming and signed download metadata. No external R2 or
staging operation was performed.

REST/MCP export routes, dashboard download/progress flows, bulk ZIP,
frame/caption/circle rendering and staging acceptance remain open. This worker
slice does not complete P6 or the entire QR export requirement.


Final local verification for this slice passes all 54 root lint/typecheck/test
tasks, five enabled database/Redis integration tests with 34 assertions, and two
storage tests with 30 assertions. Provision the declared indexes with the
existing `bun run db:indexes` workflow before enabling the worker. The S3/R2
bucket must deny public object reads: the app's public assets route accepts only
`uploads/`, while export delivery uses authorized, expiring signatures.


## REST and MCP QR export delivery — 2026-10-15

The required `GET /v1/qr-codes/{id}/export?format=svg|png|pdf&size=` route now
requests a snapshot job with `qr:read`, returns 202/Location while processing,
and redirects to an expiring attachment URL when ready. The added
`GET /v1/qr-exports/{id}` polling route rechecks authorization, current workspace
membership/resource access and expiry, returning no private object key or design.
Read-only workspace viewers can export. Both routes are disabled unless private
export configuration is enabled. Cross-origin callers can read Location and
Retry-After; signed-delivery responses are private/no-store.

MCP `create_qr_code` now requests a real styled export and returns its signed URL
when ready within a bounded five-second wait. Pending results retain a job ID;
the new read-only `get_qr_export` tool retrieves status and finished delivery.
Export failures after committed QR creation retain the QR ID and available job
ID so the client does not repeat the creation. With the export flag off, existing
QR creation still works and truthfully reports exports disabled. This adds a
twelfth tool for asynchronous delivery; the eleven planned tools remain.

API startup validates private storage configuration and passes the signer to
REST/MCP only when `QR_EXPORTS_ENABLED=1`; the worker must enable the same flag.
Generated OpenAPI and TypeScript client contracts cover the new routes, including
queued and redirected export handling. The new QR export guide documents setup,
scopes, status/retry behavior, print constraints and remaining acceptance gates.

Local integration covers REST queue/worker/signing/redirect, deduplication,
viewer/read scopes, tenant isolation, bounds, disabled gates, revocation,
signing failures, invalid print designs, expiry, MCP pending polling and creation
returning a finished signed URL. Manual supported-client, external R2/staging,
dashboard progress/download flows and bulk ZIP remain open.


Final verification for REST/MCP QR delivery: 54 root lint/typecheck/test tasks
pass. The enabled REST suite passes 25 tests with 1,752 assertions; combined MCP
and export integration passes 20 tests with 137 assertions, including foreign
workspace polling and signing-failure redaction. Generated contracts and docs
checks pass. No external deployment or storage operation is included in this
local proof.


## Selected QR ZIP backend — 2026-10-15

Bulk QR export now supports 1–500 selected codes in SVG, PNG or PDF format and
128–4096 px sizes. Request validation resolves only the selected resources and
atomically persists the job plus separate immutable item snapshots; snapshots
are not packed into one oversized Mongo document. Sorted selection/design hashes
deduplicate equivalent requests. Foreign/missing/over-limit selections create no
job. Job/item cursor and expiry indexes accompany the existing single-export
indexes.

The existing durable worker discovers ZIP jobs alongside single exports. It
processes item cursor batches, reuses private design-hash artifacts, checkpoints
completed rows and progress, renews a fenced lease and resumes after retry or a
dead lease. It streams safe, unique ZIP entries into S3 multipart upload with one
5 MiB upload part in flight and a 512 MiB operation cap. Failure aborts unfinished
multipart uploads; no completed download capability is published for a partial
archive. ZIP output lives under `exports/jobs/qr/` for a 24-hour lifecycle; design
cache objects remain under the separate private `exports/qr/` prefix.

REST adds `POST /v1/qr-codes/export` and `GET /v1/qr-exports/zip/{id}`, bringing the
implemented contract to 49 operations. Both require QR read scope; export jobs
are allowed for viewers and do not mutate the selected codes. POST supports the
shared idempotency contract. Status exposes count/phase, operation limits,
stable errors and failed QR ID, and signs delivery only after current membership
and every selected code are checked. Design snapshots and private keys stay out
of status responses.

Local proof includes an actual 500-code archive selected from a 1,001-code
synthetic library, completing the selection/render/ZIP check in about 17 seconds
on the loopback fixture. The archive contains exactly the chosen 500 entries.
Other integration checks unzip and validate SVG/PNG/PDF files, recover
checkpoints without rerendering completed items, exercise the mounted Redis
worker, and reject invalid print designs, removed access, expiry and oversized
output. A real AWS SDK loopback test verifies 5 MiB multipart parts and abort of
an incomplete oversized stream. REST checks viewer/read scope, idempotent replay,
progress, private delivery and foreign/deleted resource rejection.

Dashboard selection/export/progress flows, unfinished QR design treatments,
external storage lifecycle/staging acceptance and other P6 import/export work
remain open. This backend slice does not establish full P6 completion.


Final ZIP slice checks pass all 54 root tasks, the ten enabled single/ZIP worker
integration tests, six REST/MCP QR export integration tests, three storage tests
and focused post-correction error/access checks. Generated client contracts and
operation limits are verified locally. External bucket lifecycle and staging
acceptance remain separate gates.

## QR dashboard export review and delivery — 2026-10-15

The dashboard now connects single print exports and selected ZIP exports to the
private worker jobs. The single page offers SVG, PNG and PDF, corrected print
preview options and minimum print guidance; JPEG remains available for screens.
The library offers export selection for readable QR codes, including viewers,
while delete retains its existing role gate. Export review preserves selection
across pages and filters and uses the existing searchable tag/date/keyword
controls, date grouping and 25-row server pages. Limits and full selected counts
remain explicit even when review filters hide some selected rows.

Initial compact selections become short Redis references bound to the current
workspace and user for 24 hours. This keeps a 500-code review URL below 2 KiB
while adding filters or navigating pages. The server rechecks every selected
code before creating a job. Status polling reauthenticates each request, pauses
when hidden, stops at terminal states and removes expired download links. Only
safe job fields and private attachment signatures reach the browser. Failed
print designs link back to review, according to the current role.

Loopback browser acceptance used a 1,001-code synthetic library and actual core
jobs, durable Redis, export worker and private S3 transport. It downloaded and
unzipped a two-code SVG ZIP, verified PNG magic bytes, retained selections across
pages/tag filters, reviewed 500 codes with server pagination and short references,
and covered stale-selection rejection without job creation, focused form errors,
viewer access, invalid print designs and recovery, expiry and unavailable jobs.
The capture matrix contains 36 states across English, Spanish and Portuguese,
light/dark and 1440/390 px. Evidence and independent review are under
`.impeccable/review/p6-qr-ui/`.

Web startup now validates enabled export storage configuration and HTTPS in
production, matching the API and worker flags. All three flags default off.
External bucket lifecycle, staging/native-client acceptance, remaining circular
and frame/caption design treatment, filtered link/analytics/workspace exports,
imports, advanced editing, other bulk operations and account authentication
remain open. This completes the local QR dashboard slice, not the P6 objective.

Final QR dashboard checks pass all 54 root lint/typecheck/test tasks and the
enabled browser acceptance fixture with 36 valid captures. The fresh reviewer
required viewer row checkboxes and bounded library titles; both fixes were
recaptured and scored resolved. The viewer mobile list shrank from 4,841px to
2,501px while retaining readable tags and reachable pagination. The one design
detector run had no findings. Generated docs pass drift checks and Graft is
refreshed. These are local results; external acceptance gates remain open.

## Import input, quota and atomic chunk foundation — 2026-10-15

Import infrastructure now parses UTF-8 CSV up to 10 MiB and 50,000 rows with
bounded fields/columns, escaped quotes, multiline values, BOM and CRLF support.
Column aliases cover destination/key/title/tags, all five UTM fields, expiration
and domain. Ambiguous mappings require an explicit choice; malformed row widths,
missing destinations, invalid dates and tag bounds produce distinct errors.
URL paste uses the same CSV representation. Error CSV escaping defuses spreadsheet
formulas. The parser runs on the worker side; only the first 20 rows belong in
browser preview data. No upload/mapping UI is enabled yet.

The storage adapter can issue 15-minute presigned PUT grants for exact private
`imports/{workspaceId}/{importId}.csv` keys. Grants sign the CSV content type,
exact byte count, private cache header and If-None-Match header. The import prefix
is rejected by the existing public asset route. Provider acceptance still needs
to verify signed/conditional PUT support, browser CORS and lifecycle configuration
on the real private bucket; a loopback S3 fixture verifies SDK request shape and
transport only.

Whole-import quota reservations now share the workspace mutation lock with
ordinary link and QR creation. A refused import reports exact used, reserved,
requested and available counts before creating rows. Accepted capacity is held
against other imports and ordinary creates, scoped to the workspace, creator,
resource type and billing period; holds close at 24 hours or the period boundary.
Cancellation releases only unconsumed capacity. Actual usage remains document
derived, and link/QR capacities stay separate.

`createMany` accepts an internal import batch ID and zero-based offset, bounded
to 500 rows. The transaction creates links, tags, safety-scan metadata and mutation
events, consumes capacity, advances the checkpoint and saves a request-hashed
receipt. Retry returns the committed values; changed input, a skipped offset,
foreign ownership, expired capacity or lost creation permission fails closed.
Stable `importId`/`importRow` fields preserve row identity. A retry after a
post-commit cache error repeats invalidation for the real committed keys.
Receipts and closed reservations retain a 30-day recovery window after hold
expiry; they do not reopen capacity or permit new rows after expiry.

Six parser tests and ten enabled Mongo/Redis integration tests pass 95 assertions,
including 50k input rows, concurrent quota claims, all-or-nothing rollback on a
receipt failure, worker-context replacement, concurrent identical chunks,
post-commit cache recovery and 1,000 rows committed as two 500-row batches.
The upload grant test passes 21 assertions. Existing enabled bulk-link and
QR/campaign integration suites also pass their twelve tests. These are local
foundation checks, not the 50k-row staging throughput or worker-kill acceptance.

Durable import jobs, row snapshots, shared-core full dry run and error CSV,
QR commit support, completion events, progress/mapping/upload UI and external
acceptance remain open. The P6 goal remains active.

Final foundation checks pass all 54 root lint/typecheck/test tasks, all four
storage transport tests (58 assertions), and the enabled import/parser tests
above. A live loopback request to the public asset route for an import key returns
404. Graft was rebuilt. Reservation concurrency evidence covers v2 writers;
legacy writer coordination during coexistence must be resolved before enabling
imports alongside legacy creation. No live upload/import routes or worker flags
were enabled by this foundation slice.

## Durable link import jobs and throughput — 2026-10-15

The worker now orchestrates actor/workspace-scoped upload, inspection, mapping,
full dry run and commit states. Source rows are snapshotted in 500-row Mongo
transactions. A source hash rejects changed uploads during recovery. Poll views
return headers/counts and at most 20 preview rows with 200-character cells; full
source data and storage/lease keys stay server-side. Mapping changes create an
isolated result generation and cannot mutate a committing import.

Every dry-run row uses shared creation validation: destination safety/format,
custom-key and reserved-name rules, current custom-domain ownership and plan
features. The worker also detects repeated custom keys within the input. It
persists normalized valid rows and per-row errors without creating links/tags or
reserving quota. Error CSV output streams into private storage with formula-safe
cells; delivery checks current workspace access and the job's expiry.

Commit reserves the whole valid row count before creation. It uses the existing
500-row receipt path, now with the worker's lease checked and the job checkpoint
advanced inside the row transaction. Cancellation and replacement workers cannot
race new chunks past that fence. The creator's current membership/permission is
checked per stage and chunk. Failure/cancellation releases unconsumed capacity;
created rows keep counting as usage. A job with all rows committed finalizes its
event rather than accepting a late cancellation.

The completed job state and `import.completed` outbox event commit together. A
failed completion-event write leaves existing rows intact and retries the event
without duplicating links. The event contains job identifiers and counts only.
Startup mounts a bounded Mongo-outbox/BullMQ pump under `IMPORTS_ENABLED=1`,
default off. Enabled startup requires five private storage settings and HTTPS in
production. The generated environment example is refreshed.

A first 50k local run exposed row-at-a-time key checks, inserts and subscription
lookups as a throughput bottleneck and was deliberately cancelled. Shared bulk
creation now checks candidate keys/aliases in batches, rechecks them under the
workspace mutation lock, inserts links in one batch and emits separate webhook
envelopes with one subscription query/batch write. Validation order, legacy
shapes, plan checks, complete rollback, individual event identity and cache
invalidation are preserved.

The complete 50,000-link local pipeline then finished in 22.8 seconds. A real
child process killed after 500 of 1,001 rows committed was replaced; the resumed
job contained exactly 1,001 rows and three receipts. Enabled worker/core tests
also cover dry-run errors, mapping generations, exact quota refusal, outbox
rollback/retry, cancellation, permission loss, changed source and real durable
Redis queue discovery. These local results use synthetic private storage and do
not replace the five-minute staging acceptance requirement.

QR import commits, upload/mapping/progress UI, cache warming, legacy writer
coordination, export/import round trip, real bucket CORS/conditional PUT/lifecycle
and staging rollout remain open. No import frontend or external service was
enabled by this slice; the full P6 goal remains active.

Final checks pass all 54 root tasks and generated documentation drift checks.
The enabled performance/rollback run passed 23 tests (4,178 assertions), including
50k throughput and process-kill recovery. The later REST/import rerun passed 32
cases (1,826 assertions), with the already-recorded performance case skipped.
The broader MCP, bio-publishing and ordinary link-service assertions also passed.
One earlier REST cleanup hook exceeded five seconds while scanning the enlarged
shared synthetic cache; the completed rerun allowed 20 seconds for cleanup, and
import fixtures now isolate/remove their own permanent cache-generation keys.
No application assertion was relaxed. Graft is refreshed.

## QR import pairs and redirect cache warming — 2026-10-15

The durable pipeline now accepts `kind: qr` as well as link jobs. It uses QR quota
for its advisory dry run and whole-import reservation. Shared creation validation
and the existing atomic batch writer build complete QR/backing pairs with a
default design, mapped key/domain, destination/UTM, title, tags and backing expiry.
The QR document, hidden backing, tag writes, mutation events, receipt and checkpoint
commit together. Hidden backing links do not consume ordinary link quota.
Receipts retain stable QR/backing/public IDs and distinguish QR from link batches.

Imported custom-domain QRs retain their authoritative domain in list/detail URLs,
design edits and export snapshots. QR deletion uses the backing document ID and
preserves same-key resources on other domains. The redirect loader is now shared
from core while its original redirect export and metrics remain intact. Its QR
lookup uses the backing-link identity, with a public-ID-qualified legacy fallback,
so same-key QRs on separate domains retain separate scan attribution.

The worker repeats receipt invalidation before warming the shared Redis cache,
using the same loader, TTL and generation protocol as redirects and at most 16
parallel loads. A separate warming checkpoint handles interruption after a row
transaction commits. Repeating this work repairs post-commit invalidation failures
and stale negative entries without recreating rows. Cache fills keep the redirect
cache's existing fail-open behavior; required invalidation errors remain retryable.
Safety checks and later invalidations keep their normal
invalidation-generation fence.

Thirteen enabled worker cases pass 165 assertions. They include link and QR
process-kill recovery after 500 committed rows, 1,001 complete QR pairs with unique
backing references and QR-only usage, whole QR quota refusal, pair-insert rollback,
custom-domain view/design/export/cache identity, same-key deletion isolation and
post-commit cache recovery. The updated complete 50,000-link run, including cache
warming, took 38.6 seconds locally. This supersedes the earlier 22.8-second local
measurement that preceded warming; staging acceptance is still required.

All 54 root lint/typecheck/test tasks pass. Thirty-six enabled redirect pipeline,
QR/campaign, bulk/quota and secondary-webhook regression cases pass 4,265 assertions.
The current import flags still default off. Dashboard upload/mapping/progress,
legacy writer coordination, export/import round trip, real-bucket behavior and
staging rollout remain open, along with the other P6 sections.

## Legacy creation and import quota coexistence — 2026-10-15

The two indexed legacy link/QR creation actions now use the shared quota
coordinator. A stable identity fence serializes legacy creates with native v2
writers and reservations even when legacy creation begins before personal
workspace provisioning. All quota-sensitive v2 link, QR and import writers use
the same identity/workspace lock order. The identity lock is initialized outside
the transaction, avoiding concurrent first-upsert conflicts.

An accepted import marks its workspace as using the document-based quota ledger.
Legacy checks then count both legacy and v2 records plus outstanding reservations,
and remain authoritative after the import hold is spent, released or expires.
Earlier legacy plan checks remain; workspaces that never accept an import keep
their existing legacy behavior. This prevents legacy usage-meter lag from
consuming reserved capacity or permitting extra writes after imported rows fill
the period. The marker is internal, optional and absent on existing workspaces.

The legacy adapter runs through Mongoose's driver-owned Db/session with narrow
type adaptation at the package boundary. It does not construct foreign-driver
BSON objects inside that transaction. Legacy QR backing and QR writes now commit
or roll back together. Existing successful response shapes and plan-limit messages
are preserved, with exact quota details on coordination refusals. Tag/title reads,
password hashing, invalidation and meter delivery stay outside the transaction.
Legacy's Next configuration transpiles the new workspace server dependencies.

Seven enabled tests using real Mongoose schemas and the native workspace driver
pass 30 assertions: defaults/old behavior, full-hold rejection, quota after hold
consumption, concurrent mixed writers, QR/link independence, QR-pair rollback and
workspace-provisioning races. Thirty-eight enabled import/quota/bulk/secondary-event
regression cases pass 4,326 assertions. The updated 50k local pipeline with cache
warming completes in 36.7 seconds. All 54 root checks and a full legacy production
build pass. The build uses synthetic environment values and loopback service
origins; no deployment or provider write was performed.

The initial build compiled and typechecked but failed page-data collection on
missing legacy environment values; the completed build supplied all synthetic
values. Deploy both updated writer versions before enabling imports in a
coexistence environment. Dashboard integration, export/import round trip, real
bucket behavior and staging acceptance remain open; the P6 goal remains active.

## Import dashboard and bounded row review — 2026-10-15

The Links and QR library headers now open the in-page import flow. CSV files
upload directly to private storage; pasted URLs use the same browser-generated
CSV pipeline. Authenticated server actions accept metadata only and enforce
current workspace/role access on upload, mapping, commit, cancellation and reads.
The independent web `IMPORTS_ENABLED` flag defaults off and validates complete
private storage configuration and production HTTPS, matching the worker gate.

The dashboard covers automatic/manual column mapping, the first 20 clipped source
rows, a full dry run, per-row failures and private error CSV download, exact quota
review, explicit creation of all valid rows, cancellation, expiry and background
progress. Mapping/preview collapse after a dry run to keep row results near the
review. History and row results paginate at 25; tags are searched on the server
with 50 suggestions maximum, and rows support literal search, status/error
filters and error grouping. The browser receives no complete source/result set.

The synthetic local browser harness verifies actual direct conditional PUTs,
file and paste input, invalid-mapping recovery, dry run without quota holds,
error CSV attachment, pagination and tag filters, whole-quota refusal before
creation, cancellation, and successful link and QR creation. Eighteen captures
cover desktop/mobile, English/Portuguese/Spanish, light/dark and key phases. A
separate real-Mongo test reviews 50,000 results without sending more than 25 rows;
it covers actor/workspace isolation, expiry, generations, literal search, bounded
tag suggestions, upload signing failure and retry-safe completion.

Export/import round trip, real bucket CORS/conditional PUT/lifecycle, staging
throughput and staged rollout remain open. This local slice does not complete P6.

The independent Impeccable finish review found one material localization issue
in applied filter chips. The correction omits the ungrouped default and translates
status/group/kind/state/error values while preserving user search/tag text. The
reviewer scored that sole fix resolved and returned `ship` at the fix scope.
Review artifacts and the documentation handoff are kept in
`.impeccable/review/p6-import-ui/`; canonical visual-system files remain unchanged.

## Filtered link export backend and CSV round trip — 2026-10-15

Filtered export and Links browsing now share `linkListFilter`, preserving the
same tenant/legacy ownership, hidden/QR/trash exclusions, literal keyword, tags,
campaign, status and created-date predicates. CSV and JSON encode incrementally
from a 500-document Mongo snapshot cursor; neither the source library nor the
complete export is accumulated in the browser. Current membership and the
existing csvExport/campaignExport plan gates are rechecked outside the snapshot.
Abort, access loss and plan changes stop subsequent batches.

`prepareLinkExport` returns a server-only frozen ID selection below 5,000 rows;
its caller must pass that selection to the encoder and must never serialize it
as a browser library. This prevents concurrent inserts growing an instant
response beyond 4,999 rows. At 5,000 or more, it creates a creator/workspace-bound,
24-hour durable job with request-token retry deduplication. The BullMQ worker
streams through private multipart storage, renews fenced leases, checkpoints
processed counts, retries transient storage failures and publishes only a
complete object under its current attempt token. Cancellation, stale leases,
removed members, expiry and foreign object keys cannot expose a download.

The web/API/worker `EXPORTS_ENABLED` flag defaults off independently of import
and QR flags; enabling requires all private S3 settings and production HTTPS.
Worker startup/pump/shutdown and indexes are wired. HTTP/dashboard delivery
routes are the next integration step; the backend's stream selection is private
server state, not a browser response contract. Analytics and workspace ZIP/email
exports remain open.

The versioned, spreadsheet-safe CSV format restores literal apostrophes and
encodes tags as arrays to preserve delimiter-bearing names. A real worker round
trip into a different workspace verifies destinations, free keys, tags, Unicode,
quotes, apostrophes, repeated UTM query parameters and expiry. Source snapshot
mutation/insert tests, abort and membership loss, the exact 4,999/5,000 boundary,
private signing/expiry, job retry/deduplication, stale-lease recovery and real
BullMQ processing pass locally. These checks do not establish staging or real
object-provider acceptance.

Verification for this backend checkpoint: 28 parser/format/environment tests
passed (10,414 assertions), and 31 enabled import/export/link/trash integration
tests passed (422 assertions). One separately gated 50k-write throughput test
was skipped. Core, worker, web, API, environment and database typechecks passed;
changed package lints and generated-documentation drift checks passed. The worker
suite explicitly exercises loss of export entitlement during a stream and before
a queued job, with no signed delivery after entitlement loss. These are loopback
fixtures; no external services were enabled.

## Authenticated link export HTTP delivery — 2026-10-15

Private dashboard session endpoints now prepare metadata-only exports, stream
small attachments, poll safe job metadata/private signed delivery, and cancel
jobs. Preparation/cancellation check the exact configured Origin; all endpoints
check current session/workspace/entitlement and return private/no-store, Cookie
variance and nosniff. JSON bodies are capped at 32 KiB without trusting
Content-Length. Small selections stay in creator/workspace-bound Redis references
for 15 minutes; the browser sees no selection IDs or full filter. Pull-based
streaming forwards backpressure, abort and cancellation to cursor cleanup.

A local HTTP harness verifies a real 4,999-row Chromium CSV attachment and a
5,000-row BullMQ/private JSON job, reversible CSV content, the no-growth selection
boundary, metadata redaction, CSRF/input/body-size rejection, a valid foreign
workspace, token expiry, idempotent job preparation and cancellation, completed-job
cancellation refusal, and live export-entitlement revocation. Unit checks cover
bounded body consumption, exact Origin, private attachments, backpressure and
iterator cleanup on disconnect. All fixtures are loopback/synthetic.

The in-page export UI, analytics/workspace exports and
external acceptance remain open. This checkpoint does not complete P6.

HTTP checkpoint validation: the live loopback harness passed browser download,
private job delivery, HEAD/token checks, reversible content and all stated access
boundaries. Three transport unit tests passed (26 assertions), web/core typechecks,
web lint and changed-scope whitespace checks passed. HEAD performs access checks
without constructing a streaming cursor. The private dashboard routes do not add
a new requirement to the explicit public REST endpoint contract in spec 10.


## Filtered link export dashboard — 2026-10-15

The Links header now opens an in-page whole-filter CSV/JSON review, preserving
search, tags, status, created-date, trash and sorting while discarding the library
page number and arbitrary row selection. Review rows use the existing divided
Links list, date grouping and 25-row server pagination. Main Links and export
review share the query parser and bounded server-side tag search (50 suggestions,
selected names retained), including legacy 64-character tag labels.

Small exports expose the authenticated 15-minute download; 5,000 or more rows
open a background status page with cancellation and private completed delivery.
History filters unexpired jobs by state/format with 25-row server pagination.
Current database membership and role determine own-job versus workspace-admin
visibility; private filters, keys and leases never appear in history responses.
The UI covers empty, retry, expired and plan/access-loss states in en/pt/es and
light/dark themes, with duplicate-submit guards and visible-page polling.

The browser harness passed with 5,000 synthetic links and 103 tags, downloaded all
27 matches across two review pages as CSV and JSON, searched beyond initial tag
suggestions, cancelled a pending job, completed/downloaded a real worker job,
and verified 30-job history pagination, expiry, plan revocation and 390px bounds.
Worker integration passed 20 active tests (345 assertions); the staging/50k
throughput test remains separately gated. Web/core/UI/worker typechecks and web
lint pass. The shared-controls browser regression also passes across en/pt/es, themes and desktop/mobile after waiting for Next to discover its temporary fixture route. Analytics/raw-retention/workspace exports, remaining advanced/bulk
management and QR treatments, identity features, real storage and staging rollout
remain open. This completes the local filtered link dashboard slice only.


## Analytics export jobs and private HTTP — 2026-10-15

Core now prepares durable aggregate CSV and raw CSV/NDJSON jobs. Owned analytics
scope/filter resolution and plan retention are shared with the query service.
The effective request-time window is bounded at preparation; upgrades cannot
widen it, while narrowed entitlement fails closed. Current membership, scope and
plan are rechecked outside a Mongo snapshot between 500-row batches and on worker
heartbeats/delivery. Native time-series integration proves the snapshot remains
consistent across aggregate sections during concurrent insertion.

Raw DTOs exclude identifiers, hashes, raw IP and user agents. Aggregate cursors
stream all requested plan-allowed groups rather than inheriting dashboard limits;
two-stage visitor grouping avoids unbounded accumulator arrays. CSV protects
formula prefixes, empty aggregate windows include zero totals and NDJSON retains
raw allowed values. A separate BullMQ queue and explicit kind predicates isolate
analytics/link jobs in the shared collection; new kind-aware due/history indexes
support dispatch and pagination. Renewable fenced attempts, retry, cancellation,
private object prefixes and 24-hour expiry follow the existing export lifecycle.

Private session HTTP routes support strict metadata-only preparation, status,
cancellation, 25-row history filters and signed completed delivery. The real Next
browser-session harness downloaded 1,005 raw NDJSON/CSV rows and aggregate CSV
through actual BullMQ and synthetic private S3. It verifies origin/auth/body
bounds, idempotency, kind/tenant isolation, cancellation, expiry and entitlement
loss. Dedicated integration also covers role changes, retention upgrades and
downgrades, stale/expired leases and snapshot stability beyond 1,000 groups.

Analytics dashboard migration from its existing direct CSV stream, full-workspace
ZIP/email, real R2/staging/rollout and the remaining P6 slices are still open. This
entry completes only local analytics job backend/private delivery work.


## Analytics dashboard export review and history — 2026-10-15

Analytics and full-breakdown export buttons now open in-page review for aggregate
CSV or raw CSV/NDJSON, preserving range, timezone, interval, owned scope and
filters. Breakdown exports retain the requested dimension and no longer download
only the capped table rows. Review shows all-matching event counts and the
retained window, freezes that window for submission, and uses bounded readable
scope/filter values. Aggregate group details only appear for aggregate mode.
Empty raw exports are disabled, while an eligible empty aggregate view can
produce zero totals. Out-of-retention dates require changing the view.

Job pages show written-row counts, indeterminate activity, cancellation, expiry,
focused errors, background recovery and private completed download. Visibility-
aware polling and current-access checks remove invalid delivery. History uses
25-row server pages with mode/state/format filters and the existing divided list
and filter controls. All pages are translated into en/pt/es and reuse incumbent
light/dark Page/form design. No sheet, link picker or whole-library/event browser
fetch is introduced. The legacy private streaming endpoint remains compatible;
the dashboard entry now uses jobs exclusively.

Synthetic browser verification covers 5,000 links, 101 tags, 1,005 matching
events, all three output combinations through actual BullMQ/private S3, duplicate
submit prevention, breakdown/overview entry, cancellation, 30-job history pages
and filters, empty/expiry/plan states and 1440/390 layouts. Core analytics jobs
pass six integration tests (62 assertions), and review parser tests pass two
cases (15 assertions). Full-workspace ZIP/email, remaining advanced/bulk flows,
identity/QR treatments and external storage/staging/rollout remain open. This
entry completes the local analytics dashboard slice, not P6.


## Full-workspace archive backend, private HTTP and ready-email outbox — 2026-10-15

Current owners can request a full content/configuration archive on every plan.
The ZIP streams JSON/CSV for links, QR, bio/draft/published/version data, campaigns,
tags and domains, plus workspace metadata, manifest and all stored canonical
analytics aggregates. It includes hidden/backing/trash links and complete legacy
bio links beyond editor normalization limits. Explicit projections/DTOs exclude
auth credentials, password/provider secrets and raw visitor data; references to
foreign links are filtered. Stored QR gradients and native/legacy ownership are
preserved. One snapshot covers every file with 500-row batched cursor cleanup
and bounded ZIP/storage backpressure.

A distinct workspace job kind/queue uses renewable fenced attempts, five
transport retries, one-GiB archive bound and private 24-hour expiry. Atomic indexes
allow only one pending/running archive per workspace, with 409 for a different
request and stable accepted UUID retry; expired active jobs release capacity
before TTL cleanup. Current DB owner identity/membership is checked during
creation, batches, worker heartbeats, status and delivery. Cancellation, lost
ownership and stale leases never publish a usable partial result.

Private session HTTP supports metadata-only preparation, status/download,
cancellation and 25-row history. A separate email outbox retries without
regenerating the archive, requires the requester's current verified owner email,
and uses a stable provider idempotency key. The en/pt/es email links to an
authenticated dashboard export page rather than embedding a signed capability.
That workspace dashboard/email click flow remains to be implemented; missing
mail transport remains retryable, and no real provider email was sent by local
verification. EXPORTS_ENABLED remains off by default.

Integration verifies 5,001 links, a complete 2,501-link legacy bio, 18 entries,
concurrent snapshot writes, all stored aggregates on free, owner/kind/tenant
isolation, active-job concurrency and expiry, running cancel, retry/stale lease,
mail retry/idempotency and actual BullMQ. The actual Next/session/private-S3
harness downloads and opens the ZIP and checks metadata/auth/CSRF/roles/history/
expiry. Workspace UI, remaining advanced/bulk and identity/QR work, and external
mail/storage/staging/rollout still remain open; P6 is not complete.


## Full-workspace dashboard and email sign-in return — 2026-10-15

General settings now exposes owner-only workspace export review, preparation,
progress/cancellation/download and state-filtered 25-row history. The review
states archive coverage, 1 GiB maximum, one active archive and 24-hour expiry;
an active job offers Continue. Metadata-only requests use stable UUID retries
and a duplicate guard. The browser never loads the workspace library.

Status shows phase and physical rows written without a fabricated percentage.
Completed ZIPs remain usable while ready email is pending or failed. Visible
polling continues for pending mail and pauses in hidden tabs; manual actions
invalidate older poll responses. Current access loss and expiry remove delivery.
The ready-email route preserves its validated exact destination through login;
the proxy overwrites the private return header rather than trusting a caller.

The loopback browser harness passes with an isolated free workspace containing
5,001 links, 100 tags and a complete 2,501-link legacy bio. It opens the actual
18-entry worker/private-S3 ZIP, verifies duplicate/active/cancel behavior,
32-job history over two pages and state filtering, error recovery, owner loss
and expiry. A fake notifier verifies pending-to-sent polling and signed-out
email/sign-in/exact-job/download. No real mail was sent. Captures cover en/pt/es,
light/dark and 1440/390 widths; evidence is in
`.impeccable/review/p6-workspace-export-ui/`. Return-path/phase helper tests pass
(2 tests, 16 assertions).

Remaining advanced/bulk and identity/QR work, external mail/storage/staging and
rollout remain open. P6 is not complete; production flags remain off by default.


## Bulk link tags and selection review — 2026-10-15

Links now offers Edit tags alongside Delete selected. A bounded selection persists
across pages and filters; cancellation preserves it and a successful mutation
clears it. Editors can select other creators’ links for tagging while delete
continues to apply its existing creator/role checks. Viewers cannot select or
mutate links.

The in-page review at `/{workspace}/links/tags` stores up to 500 selected IDs in
actor/workspace-bound Redis references for 24 hours. Only 25 link views are sent
per page. Shared Links search, searchable tags, status/date/sort controls and
per-page tag grouping help inspect the selection. Review filters never narrow or
expand the operation: explicit counts and copy describe the original selection.
Tag search returns up to 50 matches, including tags beyond the initial page;
chosen tags remain visible when search results change.

Add, Remove and Replace modes state their effect before Apply. The operation
allows at most 50 tags per link. Empty Replace requires a separate confirmation
to clear every tag. Duplicate/pending guards, focused errors and retry preserve
choices. Lost access, expired selections, missing/deleted/hidden/QR links and tag
limit overflow refuse without partial edits. A single snapshot transaction
validates the entire selection before writes, maintains embedded/canonical tag
IDs and legacy personal ownership, preserves other link fields, retries write
conflicts and emits one webhook outbox event per changed link. Repeated identical
operations are no-ops. Tags do not affect redirect payloads.

Loopback integration passes six tests (43 assertions): 500 selected rows within
a 5,001-link library, concurrent adds, legacy ownership, add/remove/replace/clear,
no-op retries, exact webhook counts, role/tenant/stale/hidden/QR refusal, operation
and per-link limits, and bounded disjoint review pages/filter scope. The actual
Next/session browser harness uses 5,001 links and 100 tags and verifies selection
across pages/filters, cancellation, tag search beyond the first 50, duplicate
submission and retry, 26-link add, 51-link replacement despite a one-row filtered
review, remove/confirmed clear, selection cleanup and editor/viewer/access-loss/
stale/expiry behavior. Evidence: `.impeccable/review/p6-bulk-tags/`.

Advanced editing/create helpers, campaign/archive bulk flows, deferred identity
features, remaining QR treatments and external acceptance/rollout remain open.
P6 is not complete.


## Bulk campaign moves and canonical UTM writes — 2026-10-16

Links selection now opens an in-page Move to campaign review. Up to 500 IDs stay
selected across pages and filters; actor/workspace-bound Redis references expire
after 24 hours. Cancel keeps the selection and success clears it. Current edit
permission and the campaigns entitlement are checked on page, search and save.

The campaign picker searches literal titles and browses cursor pages of 25
campaigns, with Previous/Next controls in an optional shared Combobox footer.
It sends counts and bounded target metadata rather than campaign link arrays.
The chosen target remains visible across result pages/searches; request-generation
guards reject stale results. A separate confirmation states that all previous
campaign associations will be replaced. The selected-link review reuses Links
search, searchable tags, status/date/sort controls, tag grouping and 25-row
pagination. Filters change the review, while the full selection stays the target.

The core move validates all selected visible, active, ordinary links and the
owned destination before writes. One snapshot transaction uses the same campaign
mutation fence as rename/delete/single-link UTM editing. It replaces each UTM
variant’s campaign ID/title, preserves source/medium/term/content and link rules,
and creates a campaign-only variant when none exists. Destination defaults do
not overwrite authored values. Old owned backlinks are removed and the new
membership is added atomically; now-empty campaign containers remain available.
No-op retries emit no duplicate webhook events. All selected keys and historical
aliases are invalidated even on a no-op retry, allowing recovery from a Redis
failure after the database committed.

The shared campaign writer now maintains the migration’s canonical UTM variants
and hash alongside legacy UTM objects. It uses the workspace root domain when a
legacy link has no explicit domain, preserving its redirect namespace through
bulk moves and single-link edits. An actual redirect-loader regression proves
that such a link remains resolvable.

Native MongoDB/Redis integration and existing QR/campaign/analytics regressions
pass 13 tests with 115 assertions. They cover 500 selected rows in a 5,001-link
library, concurrent complete moves, roles/plans/tenant/stale/hidden/QR refusals,
metadata bounds, exact webhook counts, UTM/canonical/backlink consistency,
idempotence, alias invalidation and existing single-link rename/delete behavior.
Actual Next/session browser evidence uses 5,001 links, 100 tags and 1,001
campaigns: cross-page/filter selection, cancel, picker paging/search beyond the
initial page, preserved target, confirmation/retry/duplicate guards, 26-link and
51-link moves despite a one-row filtered review, field/domain preservation,
selection cleanup, stale target, role/plan loss, expiry and empty search. English,
Portuguese and Spanish light/dark desktop/mobile evidence lives in
`.impeccable/review/p6-bulk-campaign/`.

Archive bulk actions, advanced editing/create helpers, deferred account identity,
remaining QR treatments, external acceptance and staged rollout remain open.
P6 is not complete.


## Bulk archive/unarchive and archived library — 2026-10-16

The Links dashboard now separates active, archived and trashed links. Archive
sets the existing `archivedAt` management field; redirects, aliases, QR codes,
analytics, UTM variants, campaign/bio associations and quota accounting remain
intact. Unarchive removes that field. Deleted links retain their independent
30-day trash lifecycle; restoring an archived deleted link returns it to the
archived library. This dashboard operation does not change the existing MCP
`archive_link` soft-delete contract.

A fixed actor/workspace-bound selection reference expires after 24 hours.
The full 1–500-ID operation validates ownership and ordinary visible live-link
eligibility before any link write, then updates all changed rows and per-link
`link.updated` outbox events inside one snapshot transaction. A workspace
archive revision serializes inverse operations, including no-op selections
with mixed archive states. Retries preserve original archive timestamps and
emit no duplicate events. Event data explicitly includes the archive state and
uses the existing public-field allowlist. No redirect recompile or invalidation
is needed because archive is absent from redirect payloads.

Both actions use in-page confirmation and a server-paginated 25-row selected
review with shared Links filters and tag grouping. Filters only change the
review, never the operation selection. The Archived library reuses the main
Links table, remote tag filtering, search, dates/status/sort, grouping and
server pagination. Export navigation retains its archived filter. Shared bulk
selection now appends its encoded IDs correctly to action URLs that already
carry query parameters, enabling the unarchive action. Long titles are bounded
and controls reflow at 390px. All new copy is localized in en/pt/es.

Local evidence is under `.impeccable/review/p6-bulk-archive/`. The combined archive, tagging, campaign, trash, export/import and URL-scope regressions pass 48 tests with 623 assertions; the opt-in 50k throughput case remains skipped. Web/core types and lint, documentation generation checks and scoped diff checks pass. Native integration
coverage includes 500 selected links from 5,001, safe event data, no-op retries,
unchanged redirect payloads and associations, tenant/role/eligibility refusal,
concurrent inverse operations, trash restoration and fixed-selection review.
The real Next/session/database browser fixture uses 5,001 links, 100 tags and
1,001 campaigns on a free plan, verifies 51-link archive despite a one-row
review filter, 25-link unarchive, cross-page/filter selection and cancel,
transient failure/duplicate guards, stale selections, current permission and
expiry. Fifteen native viewport captures cover desktop/mobile and en/pt/es
light/dark states.

Advanced editing/create helpers, deferred account identity, remaining QR design
treatments and external storage/mail/staging/MCP-client/rollout gates remain
open; this local slice does not complete P6.


## In-page advanced link options — 2026-10-16

Create and edit now expose collapsible advanced sections inside the existing
LinkForm: UTC activation/expiry, approximate lifetime visit limits and fallback;
country/device targeting; sticky weighted rotation; iOS/Android app/store
fallbacks; query forwarding and permanent redirects; UTM overrides; and
bot-facing social preview metadata. Target lists are bounded to ten rows each,
with stable removal and contiguous form indices. Collapsed sections summarize
configured effects. Existing basics, tags, passwords and UTM variants remain
intact. All new controls and guidance are localized in en/pt/es.

A versioned FormData parser runs before mutation. It rejects duplicate, unknown,
oversized or malformed advanced fields, invalid calendar dates and schedules,
incomplete/out-of-range targeting rows, unsafe destinations and preview images
through the canonical core schemas. Dates explicitly use UTC. Older forms that
omit the marker preserve advanced data; an explicitly empty advanced editor
clears rules and preview. New and edited destinations use the existing safety
pipeline; unchanged destinations do not trigger a redundant scan merely because
the advanced editor was submitted.

Browser verification caught a legacy root-domain bug in the shared edit writer: a
link without a stored domain inherited the process default rather than the
workspace's root. Both edit and safety-scan writers now supply `ctx.linkDomain`
when the legacy domain is absent. Native loader regression proves that the link
stays resolvable in its original namespace through both writes.

Twenty-three native parser/rules/safety/social-preview/link-service tests pass
126 assertions. Real Next/session/server-action/database browser checks save all
rule families and preview, reject an incomplete row before partial writes,
verify UTC and namespace preservation, reload/localization, ten-row bounds and
stable removal, clear rules/preview while preserving campaign variants, and
create a new advanced link. Thirteen section/subsection viewport captures cover
desktop/mobile and en/pt/es light/dark; they intentionally document the advanced
section inside the longer existing form, not the global document top. Evidence:
`.impeccable/review/p6-link-advanced/`. Web/core types and lint pass.

Creation/paste/title/key helpers, any remaining branch-dashboard work, deferred
account identity, remaining QR treatments and external storage/mail/staging/
client/rollout gates remain open. This slice does not complete P6.


## Creation paste, worker title/key suggestions and clipboard completion — 2026-10-16

Pasting one explicit HTTP(S) URL on Links outside editable controls opens the
existing New link page with the destination prefilled, preserving its query and
fragment. Existing command-palette creation remains available. Optional page
details populate untouched title/key fields; authored edits are retained, with
explicit controls to use suggestions again. URL changes discard stale results.
Loading, ready, unavailable and retry states never prevent manual creation.
Titles work on free plans; custom-key suggestions use the current entitlement.

The worker processes short-lived Mongo metadata jobs bound to actor/workspace.
Requests deduplicate by normalized URL and a time bucket, expire after fifteen
minutes with a TTL index, and allow ten distinct lookup/retry requests per minute
per actor/workspace via durable Redis. A crashed thirty-second lease can be
reclaimed; conditional completion prevents stale workers overwriting results.
Current membership is checked at request/read and before/after fetch. Optional
fetch failures are retryable and never mutate existing links.

HTML fetching reuses the existing public-address validation and DNS pin. It
checks every redirect, refuses private/mixed DNS answers and credentials, bounds
redirects, headers, total deadline and HTML body reads (256 KiB), requests
uncompressed HTML and sends no browser cookies. Open Graph title takes priority
over the HTML title; extracted text is normalized and bounded. Key suggestions
reuse canonical validation, reserved names and global domain/legacy/alias/trash
collision checks. They are advisory; final creation remains authoritative.

Successful creation returns its actual short URL to the client. Enter submits
the normal form, with a synchronous duplicate guard; the client attempts to copy
the URL before opening the existing overview. Clipboard denial or timeout keeps
creation successful and shows a truthful notice pointing to the existing Copy
control. All new messages are localized in en/pt/es.

Twenty-five native metadata/network/key/link-service/normalization tests pass
174 assertions. Browser proof uses actual Next/session/server actions, Mongo/
Redis jobs and worker helpers with a loopback HTTP fixture; all13 current native
viewport captures were inspected in the bounded first/confirmation rounds.
It verifies editable paste exclusion, fragments, manual edits, stale results,
retry, command palette, Enter and same-frame duplicate prevention, actual
clipboard readback, denial recovery, free-plan title lookup, localization/themes
and creation before lookup completes. No external provider writes occur.
Evidence: `.impeccable/review/p6-link-creation/`.

Deferred account identity, remaining QR/branch work and external storage/mail/
staging/client/rollout gates remain open; this local slice does not complete P6.


## Routing branch dashboard and current QR parity audit — 2026-10-16

The analytics backend already stores and aggregates `m.branch`; the dashboard
now exposes Routing branches in its existing overview/full-table flow and
searchable filter groups. Link, QR, campaign and workspace scopes keep shared
entitlement, retention, date/type filtering, sorting and export review behavior.
Recorded target positions get one-based labels; missing historical values show
Not recorded, and future unknown identifiers remain visible. The full-table
page explains that positions belong to each link at visit time and historical
rule reorders can combine different destinations. Filter to one link to compare
its targets. No destination URL is inferred from today's rules.

Local browser proof uses an isolated 5,001-link workspace with actual Next,
sessions, actions and Mongo/Redis. Shared queries verify exact counts across
eight branches, missing-value filtering, tenant/link isolation and the current
free-plan gate; browser checks cover drilldown scope, export dimension, localized
light/dark mobile/desktop and bounded layout. Twenty-nine query/sort/CSV/catalog
tests pass 5,270 assertions. Evidence: `.impeccable/review/p6-analytics-branches/`.

The existing synthetic QR parity suite also passes all 39 comparisons below
1% changed pixels at 1024px: six dot styles crossed with six legacy finder
styles, fractional modules and linear/radial gradients. This establishes the
current square cases only. Circle/frame/caption treatment is still pending:
`renderQrSvg` explicitly refuses non-square shapes, and the editor schema has
no circle/frame/caption options. The vendor circle's decorative modules approach
the data matrix more closely than the required four-module quiet zone, so a
matching client/worker print-safe treatment is required before enabling it.
The production legacy QR sample and external storage/rollout gates remain open.

The branch finish review required shorter Portuguese/Spanish target labels so
mobile tables distinguish rotation targets without hover. The corrected labels
pass native width assertions and the reviewer’s verdict is SHIP for that fix.
Creation helpers also completed their independent SHIP review/documentation;
the existing advanced-editor browser regression passes. P6 remains active.


## QR circle, frame and caption treatment completion — 2026-10-16

QR create/design now offers square or circular badges, none/outline/solid frames
and optional captions up to 64 characters, using the incumbent in-page editor.
Circle preserves the square QR matrix and four-module quiet zone; frames and
caption panels remain outside it. Captions use deterministic vector glyph
outlines from a bundled unmodified OFL Geist font. Shared NFC/cmap/control/length
validation refuses unsupported symbols before core side effects and gives
localized recovery. Captions use at least 4.5:1 text contrast against their own
opaque panel, while QR modules retain the print threshold of 3:1.

Browser previews/downloads and worker SVG/PNG/PDF share treatment geometry and
caption paths, Q/H correction and quiet-zone policy. Print minimum accounts for
space used by treatments. Explicit clearing preserves the encoded URL. Existing
legacy option groups continue to merge. Failed preview rendering clears stale
images and shows an honest unavailable state; unsupported caption errors replace
positive scan guidance. Circle exports are enabled in the existing review flow,
and renderer cache version 2 prevents older artifact reuse.

The actual browser render helper and worker renderer pass all 55 comparisons
below 1% changed pixels at 1024px, covering the 39 prior square/gradient cases,
12 shape/frame/caption combinations, a 64-character wide caption, native dot
finders and square/rectangular logos with H correction. Native core/renderer/
editor/catalog/private export/ZIP checks pass 51 tests and 5,680 assertions with
no skips. Real Next/session/actions/Mongo/Redis browser checks create and save
treatments on a free plan, open and decode the private worker PNG download,
refuse unsupported caption writes, clear treatments without changing encoded
data and exercise en/pt/es light/dark desktop/mobile. Twelve current native
captures were inspected in bounded first/confirmation rounds. Evidence lives in
`.impeccable/review/p6-qr-treatments/`; independent review/documentation is tracked
there. Local services were restarted after OrbStack stopped; existing data
volumes were preserved.

The production legacy QR sample is still required. Deferred account identity,
external storage/mail, staging throughput/client acceptance and staged rollout
remain open; these local QR results do not complete P6.

The QR finish reviewer returned SHIP without material fixes across all twelve
captures. Six additional native REST/MCP export-contract tests pass 59 assertions
using the new circle/caption fixture, including private artifacts, scopes,
revocation, status/signing and bounded MCP completion. Web/core/worker/API/renderer
types and relevant lints pass; generated API contracts are current.


## Account authentication dependency and compatibility foundation — 2026-10-16

Better Auth, the web and legacy direct dependencies, and the standalone OAuth
provider are pinned together at 1.7.10. The matching passkey and SSO packages are
installed for the deferred account-security implementation. Those plugins and
account-security screens are not enabled yet; milestone 6.10 remains incomplete.
This establishes a patched foundation before introducing Enterprise SSO; see
[the upstream SSO domain-trust advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-8c5h-wx78-2cfg).

The upgrade preserves the shared `user`, `session`, `account`, and `verification`
collections and `shortn_auth_` cookie prefix. Sessions remain in Mongo without a
Redis session cache. A pinned synthetic 1.4.18 fixture proves that its original
password hash and signed session cookie resolve the same user through the new
handler, and that deleting the Mongo session invalidates the old cookie
immediately. This is native handler compatibility evidence, not a completed
browser check of every legacy login or handoff flow.

Auth rate limits now use the required atomic `consume` operation. One Redis Lua
script checks and increments the counter using Redis time, anchors expiry to the
first admitted request, and leaves expiry unchanged on rejection. The v2 Redis
namespace avoids interpreting old JSON counters as hashes. A real Redis test
admits exactly ten of one hundred concurrent requests, checks retry intervals,
and verifies reset and isolation. Redis errors fail the request rather than
silently weakening the limit.

The OAuth provider now declares the MCP resource and its registration default
explicitly. Consent-query validation matches the provider's canonical signature
format, allows repeated signed parameter-name metadata, and continues rejecting
repeated business parameters. Username continuation carries only signed query
parameters, and server pages preserve the repeated metadata. Native clients
register explicitly as `native` and receive HTTP 201. Attempts to disable PKCE
or self-assert consent bypass are rejected. Social disconnection now uses the
Better Auth account row ID required by the upgraded endpoint; legacy email
verification uses the current callback name.

New resource and client-resource collections are included in physical-name
configuration and the repo index manager. The provider's mandatory composite
index uses the same stable name as the repo manager, avoiding a Mongo runtime
index-name conflict. The native fixture runs index sync before auth startup.
API token verification also checks the current resource and client-resource
link, so disabling the resource or removing its link immediately denies tokens.

Existing MCP registrations need a one-time resource-link backfill before MCP
traffic resumes on the upgraded provider. Coordinate the legacy and new-app
upgrade, sync indexes, initialize the patched auth provider with the configured
MCP resource, then run:

```sh
bun packages/auth/migrate-mcp-resources.ts --dry-run
bun packages/auth/migrate-mcp-resources.ts --apply
bun packages/auth/migrate-mcp-resources.ts --dry-run
```

The command requires `MONGODB_URL`, `MONGODB_DB`, and `MCP_PUBLIC_ORIGIN` from the
target environment. It defaults to reporting only, refuses an unconfigured or
disabled resource, processes at most 500 clients per batch, and inserts missing
links without changing existing links, scopes, consent, ownership, or tokens.
The final dry run must report zero missing links. This migration has been tested
locally for dry-run behavior and idempotency; it has not run against staging or
production. Pending pre-upgrade provider authorization queries should restart
at authorization rather than being treated as compatible signed consent state.

Local verification: 13 auth tests / 143 assertions and 15 native MCP transport
and tool tests pass, with no skips. The twelve DB contract tests also pass.
Auth, DB, core, web, and legacy type checks pass; auth lint and the changed web
and core modules pass scoped lint. A fresh web/API process passes actual browser
email and username login, workspace selection, consent, PKCE token exchange,
real MCP invocation, cancellation, stale workspace rejection, keyboard use,
and 28 English/Portuguese/Spanish light/dark desktop/mobile captures with overflow
checks. No production mail, provider credentials, or external deployment was
used.

Remaining account-security work: gated TOTP setup, verification and recovery;
passkey enrollment/login/revocation; Enterprise SAML/OIDC configuration and
consent; enforced checks across legacy password login and handoff; session
revocation on security changes; and browser/native evidence for the completed
flows. Workspace membership continues to use the canonical custom collections,
without adding a second organization or membership authority.


## TOTP, recovery and shared-identity enforcement — 2026-10-16

TOTP setup and password sign-in recovery are implemented locally. The account
password page is now discoverable as Password & security, with a separate
in-page authenticator section. English, Portuguese and Spanish copy explains
that this protects password sign-in across workspaces; social sign-in continues
to follow the provider's security settings. Passkeys and Enterprise SSO remain
unfinished, so milestone 6.10 and P6 are still open.

Enrollment requires a verified email, a credential password, a session created
within five minutes, and current membership of at least one canonical workspace
with `platformFeatures.advancedAuth: true`. Impersonated sessions cannot manage
these settings. Eligibility is checked again when confirming pending setup.
The plugin remains registered regardless of the feature flag: removing the flag
or membership prevents new enrollment, while enabled accounts keep their
password challenge and can recover or disable their existing factor.

The setup secret and ten recovery codes are encrypted in the shared `twoFactor`
collection (physical-name key `two_factor`), with a unique user index. The user
scans a local SVG QR or reveals the manual key, saves the recovery codes, then
proves a six-digit code before activation. The QR uses the repo matrix encoder,
keeps its quiet zone, and is independently decoded in the browser test. No
secret is sent to an external QR service. Recovery codes disappear from the UI
on Finish. Replacing them invalidates the previous set and requires a new save
acknowledgement. Turning the factor off requires a recent session, the current
password and an explicit effect acknowledgement.

Password login creates only a pending, expiring challenge until a TOTP or
recovery code succeeds. Successful TOTP steps are claimed atomically in Mongo;
a code cannot be reused or authenticate two concurrent challenges. Upstream
recovery-code compare-and-swap also prevents concurrent reuse. The default
challenge and account lockout budgets remain active. Trusted-device bypass is
unavailable. Already-active authenticator secrets cannot be exported through
the public TOTP-URI endpoint. Enabling/disabling revokes other shared Mongo
sessions and pending handoffs before issuing the replacement session. Security
updates skip Polar customer synchronization because they do not change customer
identity. Framework cookie integration runs after the auth hooks.

Legacy password login installs the shared gate: a protected user's tentative
session is deleted and the login screen directs them to the new app configured
by `NEW_APP_URL`. Without that configuration it displays a localized recovery
message instead of granting a legacy session. Legacy auth errors no longer log
request contexts or password-bearing client error contexts. A normal one-time
handoff proves the primary identity, then creates a second-factor challenge on
the new host before creating a full session. The existing privileged
`impersonatedBy` handoff retains its separately authorized one-hour session
behavior; victim TOTP is not used as an administrator impersonation credential.

Signed MCP authorization parameters survive the password and second-factor
pages. Both the native handler test and an actual browser test show that
workspace selection and consent remain inaccessible before verification, then
complete consent and the bound PKCE token exchange. The HTTP route converts
the provider's post-verification redirect to the JSON redirect expected by the
browser auth client, including recovery-code verification.

Verification: the combined auth, native MCP transport/tools, and DB contract
run passes 49 tests and 444 assertions, with no skips. Auth/DB/web/legacy types
and auth/scoped web lint pass. Actual browser flows pass setup, QR decoding,
acknowledgement, TOTP login, replay rejection, recovery, replacement, disabling,
ordinary login after disabling, and the separate complete second-factor MCP
OAuth path. Twenty final screenshots cover the important setup/challenge/code
states plus en/pt/es light/dark desktop/mobile enabled settings. The first
capture set contained loading frames and clipped scroll content and was
replaced; the final set waits for content/theme, resets scroll, and records
actual taller viewport heights where required. Every final image was opened.
The detector ran once with no findings. Independent finish review is SHIP;
see `.impeccable/review/p6-two-factor/` for the packet and evidence.

This is local acceptance. The running legacy app and deployed `NEW_APP_URL`
configuration still need coexistence acceptance before enabling workspace
flags outside the sandbox. No production deployment, mail or provider writes
were used. Passkey enrollment/login/revocation, Enterprise SAML/OIDC, and the
previously recorded external P6 acceptance gates remain open.


## Verified passkey enrollment, sign-in and revocation — 2026-10-16

Passkeys are implemented locally, with named enrollment and paginated management
under Account → Sign-in methods, plus an explicit passwordless login button.
The account settings use the incumbent components and in-page confirmation;
English, Portuguese and Spanish copy covers setup, fallback sign-in, fresh
sessions and the all-device sign-out consequence of removing a credential.
The list queries only 25 projected rows on the server and shows counts and page
navigation; the browser never requests the plugin's unbounded credential list.

`packages/auth/passkeys.ts` configures the 1.7.10 plugin with exact origin and
RP hostname, resident credentials and device verification. Both cryptographic
verification callbacks check the verified UV signal: browser preferences alone
are insufficient. Nonzero authentication counters have an atomic Mongo watermark;
synced credentials with zero counters remain supported. Enrollment checks
verified email, a non-impersonated session no older than five minutes and current
canonical membership in an advancedAuth-enabled workspace. Removal requires a
recent verified session and preserves another usable sign-in method; a per-user
Mongo lease serializes removals so two concurrent requests cannot each delete
the other's fallback. Labels are normalized, bounded and reject controls.
Existing credentials remain usable and removable when enrollment flags turn off.

The passkey collection has a unique credential identifier and a user/date cursor
index. Successful authentication binds the shared session to its credential row.
Removal revokes all shared sessions. New-app, legacy and live MCP validation
reject a credential-bound session whose key has disappeared, covering a session
creation/revocation race. The client preserves the provider's signed MCP query;
the auth HTTP adapter converts passkey OAuth redirects into the JSON response
expected by the fetch client. Normal login honors the sanitized return path.

Browser testing caught empty password-form blur validation moving the passkey
button between mouse-down and mouse-up. Login blur validation now runs when
focus moves within that form; choosing another sign-in method does not introduce
an unrelated password validation error. Actual mouse passkey login and keyboard
passkey MCP login both pass after the fix.

Local verification:

- Combined auth, database and API MCP suite: **83 tests, 680 assertions, zero
  failures and no skips** with Mongo and Redis. Eight real signed WebAuthn tests
  cover registration/authentication UV, exact RP/origin, challenge replay,
  concurrent counter reuse and credential removal, ownership, fresh sessions,
  flags, last-method protection and dangling new/legacy sessions.
- `apps/web/e2e/passkeys.local.ts`: actual browser virtual CTAP2 resident
  enrollment, mouse login, credential-bound session, 28-key pagination (25/3),
  fresh-session error/recovery action, flag-off management and all-session
  revocation. No page errors or document overflow.
- `apps/web/e2e/passkeys-oauth.local.ts`: keyboard passkey login through a signed
  MCP request, workspace selection, consent and successful PKCE token exchange.
- Auth, web, DB and legacy type checks and scoped auth/web/e2e lint pass. The
  detector ran once with no findings. All 21 confirmation captures were opened;
  settings cover three locales, both themes and desktop/mobile, with additional
  login, pagination, empty, error and removal states.
- Fresh finish review returned **SHIP** with no material fixes. The documenter
  confirmed the incumbent visual system; missing design artifacts were reported
  as pre-existing drift and left unchanged. Review, documentation and screenshots
  are in `.impeccable/review/p6-passkeys/`.

This checkpoint used synthetic accounts and virtual credentials; no deployment
or real hardware/provider acceptance is claimed. Enterprise SAML/OIDC remains
unfinished. It must retain the custom canonical workspace/member authority
rather than adding the organization plugin, enforce workspace flags and current
Enterprise entitlement, prove domain control, and prevent implicit provisioning
or untrusted account linking. Milestone 6.10 and P6 remain open, along with the
previously documented external rollout and production acceptance gates.

## Enterprise SSO canonical identity authority foundation — 2026-10-16

`packages/auth/sso-authority.ts` adds the transaction-bound identity boundary for
the forthcoming SAML/OIDC plugin integration. This foundation is **not enabled
in the production auth factory yet** and does not claim a working SSO login UI.
The Better Auth transaction adapter maps the existing canonical workspace,
member and subscription collections without installing the organization plugin.
Canonical member user IDs remain strings while workspace references remain
ObjectIds; the schema deliberately preserves that distinction.

Resolution requires a persisted, domain-verified provider with a pinned identity
issuer, a non-personal advancedAuth-enabled workspace, current canonical
membership and a paid Enterprise subscription using the existing billing status
rules. An existing identity resolves by the exact provider-record/issuer/subject
tuple; email equality is never a fallback account selector. First connection
requires a one-use linking intent for an existing verified user and an active,
recent, non-impersonated local session, with matching local/provider email.
The eventual protocol wrapper must take that nonce only from an application
signed HttpOnly cookie. The resolver preserves the local profile and creates
neither users nor memberships.

Binding creation, intent consumption and authority fencing use the same native
transaction as subsequent account/session finalization. Fencing writes make
concurrent membership removal, provider changes, feature changes, subscription
cancellation and local session revocation conflict rather than commit a stale
snapshot decision. Failed finalization rolls the entire unit back.

Seven native Mongo tests / 35 assertions pass, including concurrent subject
binding, membership removal during resolution, and forced transaction rollback.
Auth type checking and scoped lint pass. These tests exercise the actual native
Better Auth Mongo transaction adapter, but do not replace signed SAML/OIDC
protocol tests. Provider configuration, encrypted credentials, DNS proof,
link-consent HTTP/cookie handling, shared-session authority enforcement, browser
SSO flows and UI remain implementation work; milestone 6.10 and P6 stay open.

## Enterprise OIDC protocol factory and DNS proof — 2026-10-16

`packages/auth/enterprise-sso.ts` now implements the isolated protocol factory.
It is **not yet registered in createAuth**: signed SAML coverage and legacy/MCP
session enforcement must land before the production authentication path is
extended. This checkpoint is implementation progress, not completed Enterprise
SSO acceptance or a working dashboard SSO flow.

The factory enables vendor domain verification and disables implicit signup,
profile overwrites and unsolicited SAML responses. Registration requires a
recent verified non-impersonated Enterprise workspace owner. It pins the
identity issuer, rejects organization-plugin inputs, forces OIDC PKCE and the
openid/email/profile scopes, and forbids claim mappings into authorization
fields. SAML is configured for signed assertions, request correlation, required
timestamps and rejection of deprecated algorithms. Authentication-boundary
edits require replacing the provider, rather than silently reassigning existing
bindings. A canonical owner can delete an existing provider after Enterprise
entitlement is lost; deletion atomically removes its accounts, bindings, pending
link intents and bound sessions.

Both serialized provider configurations are encrypted by adapter transforms
with the application auth secret, including OIDC client secrets and SAML private
key material. Registration responses omit those configurations. OIDC discovery
retains the vendor's origin/network validation: deployment operators must
approve the IdP origin through trustedOrigins, including an explicit loopback
origin only in the synthetic native fixture.

The one-use link-intent endpoint records an active recent local session and
sets a signed HttpOnly cookie (Secure/SameSite=None in production for SAML POST
callbacks). Only that application cookie supplies the resolver's linking nonce.
Successful connection clears the cookie. Protocol-created sessions carry exact
provider-record and workspace IDs; new-handler get-session rejects a missing
binding, unverified provider, removed membership, disabled flag or lost
Enterprise subscription. Ordinary password sessions remain independent.

Native protocol tests use a real local OIDC discovery/token/JWKS service, signed
RS256 identity tokens, PKCE verification and a real local UDP DNS TXT server.
They verify secret encryption, wrong DNS proof, unverified-provider denial,
explicit connection, state replay rejection, exact subject/issuer binding,
local-profile preservation, session labels, flag revocation and owner deletion
after entitlement loss. Combined with canonical authority tests: **13 tests,
86 assertions, zero failures**. Auth type checking and scoped lint pass.
Signed SAML, production-factory wiring, shared legacy/MCP checks, owner/member
UI, browser continuation and external IdP acceptance remain open.

Regression verification after the isolated factory: the combined auth, API MCP
and database suite passes **96 tests / 766 assertions**, zero failures and no
skips, with the required local Mongo replica set and Redis. This includes the
previous compatibility, TOTP, passkey, OAuth, migration and MCP contract tests;
it does not exercise a production SSO route because the new factory is still
isolated. Log: `/tmp/p6-sso-regression.log`.


## Signed SAML, production wiring and shared SSO enforcement — 2026-10-16

The SSO protocol factory is now registered in `createAuth`; this supersedes the
isolated-factory status above. Real signed SAML assertions join the OIDC/native
coverage. The fixture generates an ephemeral RSA certificate and signs actual
responses, then exercises the main auth factory with canonical workspace/member
records, the application linking cookie and DNS ownership proof. Valid SAML
connection succeeds only after explicit local consent. Replay, missing or
modified signatures, unknown request IDs, wrong IdP issuers and wrong assertion
audiences are denied without creating a session.

SSO sessions retain exact provider-record and source workspace IDs. A shared
`packages/db/sso-session.ts` validator now serves new-app, legacy and MCP checks.
It requires a domain-verified provider, pinned issuer/subject binding, the exact
linked account, current canonical membership, a non-personal enabled workspace
and Enterprise entitlement. Projected reads exclude encrypted provider secrets.
The legacy session customization preserves these fields. The MCP native test
uses an SSO source workspace separate from the OAuth grant's target workspace:
source flag loss, canceled entitlement, removed account or provider invalidate
the bearer even while the target workspace remains authorized.

New provider, binding and intent collections are registered in the physical-name
map. Index management supplies unique provider identifiers, exact subject and
user/provider bindings, a unique intent nonce, intent expiry and bounded list
indexes. Canonical workspaces remain the authority; no organization plugin or
parallel member table is installed.

The explicit SSO disconnection endpoint withdraws its binding and account,
requires a recent verified non-impersonated session, preserves a password or
passkey/configured-social fallback, and revokes all the user's shared sessions
in the same transaction. Its user fencing coordinates with passkey-removal
leases. Generic account unlinking cannot bypass this consent withdrawal flow.
Owners may delete provider configuration after entitlement loss, atomically
removing its accounts, bindings, intents and provider-bound sessions.

Production linking and SAML relay cookies use HttpOnly, Secure and SameSite=None.
A native cookie-attribute test caught that a plugin initialization override was
too late: Better Auth had already constructed its cookie helpers. Relay-state
attributes now live in the main auth configuration before initialization.
That test verifies emitted attributes; actual browser cross-site POST behavior
remains part of browser acceptance and is not claimed from native requests.

Verification after wiring and disconnection: **102 tests / 847 assertions** pass
in the combined auth, API MCP and database suite, with no failures or skips.
Auth, web, core, DB and legacy type checks pass; scoped auth/core/DB lint passes.
The graph is refreshed. SSO owner/member UI, native browser protocol flows and
MCP browser continuation remain to implement/verify; live IdP, legacy deployment
and previously recorded production rollout gates remain external acceptance.
Milestone 6.10 and P6 stay open.


## Enterprise SSO dashboard, browser continuation and cross-site delivery — 2026-10-16

Workspace Settings → Workplace SSO now lets the canonical Enterprise team owner
configure OIDC or SAML, prove control of the email domain through a TXT record,
inspect verification status, download SAML SP metadata and remove a provider.
Configuration replacement is explicit: existing providers are immutable. Owner
removal remains possible after entitlement or rollout loss. Forms, DNS proofs,
errors, fresh-sign-in recovery and destructive confirmations stay in the page.

Account Settings → Sign-in methods exposes paginated workplace connections and
verified providers in the current eligible workspace. Connecting requires recent
verified local sign-in and explicit consent naming the account, provider and
workspace. That consent is checked even when the external identity already has
a binding, so a connecting flow cannot switch the local user to another bound
account. Disconnection withdraws consent and signs out all shared sessions;
password, passkey or configured social fallback remains mandatory.

Login now offers Workplace SSO. Public workspace-name lookup returns only
verified providers of an enabled Enterprise team workspace, ten per page, with
no account/member metadata or protocol secrets. Owner lists and account
connections also paginate on the server. EN/PT/ES copy and existing light/dark
settings/auth controls are retained. A 25-provider browser fixture and native
connection-view tests verify bounded pages, counts, tenant isolation, unavailable
states and secret projection. No link library is fetched by these flows.

Deployment administrators configure exact IdP origins through
`SSO_TRUSTED_ORIGINS` (comma-separated HTTPS origins, no paths, credentials or
wildcards; loopback HTTP is allowed only in development). This does not give a
workspace owner permission to change global trusted origins. The P6 sandbox's
DNS preload only resolves synthetic `_shortn-sso-*.example.test` TXT proofs
through its loopback fixture. Production continues using the regular resolver.

Signed MCP authorization survives both OIDC and SAML external redirects. OIDC
uses server-trusted OAuth state. SAML stores a short-lived, one-use continuation
against the native relay identifier, checks its signed relay cookie and provider,
revalidates the signed MCP request, and then lets native protocol verification
and the OAuth provider complete authorization. Relay validation accepts the
native identifier's complete base64url alphabet. A browser retry with an added
SSO error keeps only the declared signed query parameters for consent validation.
Both real browser flows reach workspace consent and finish PKCE token exchange.

An isolated HTTPS browser test exercises a genuinely cross-site SAML POST from
127.0.0.1 to localhost with production auth configuration. The browser sends the
Secure/HttpOnly/SameSite=None linking and relay cookies, omits the Lax ordinary
session cookie, and receives a verified SSO-bound session. Only the isolated
browser trusts the ephemeral certificate; server TLS validation stays enabled.
This supersedes the earlier native-cookie-attribute-only limitation. It does not
claim deployment or live enterprise-IdP acceptance.

Verification: **105 tests / 905 assertions**, no failures or skips, in the
combined auth, DB and API MCP suite. Environment tests pass **19 / 327**. All
**18 workspace type checks** pass, scoped SSO/auth/UI lint and changed-scope diff
checks pass, and generated-doc drift checks pass. The whole dirty worktree's diff
check still identifies three pre-existing whitespace lines in legacy action
files outside this slice; those files are preserved.

The fresh Impeccable reviewer returned **ship** for the SSO extension after
opening all 35 required desktop/mobile captures and three incumbent screenshots.
Evidence, contract and documentation comparison live under
`.impeccable/review/p6-sso/`. No visual-system or asset replacement was made.
The detector returned no findings on existing targets, but one incorrectly
named login target was absent; the reviewer manually inspected the actual
`apps/web/src/app/(auth)/login/login-form.tsx` entry. Pre-existing absent
DESIGN.md and design sidecar remain reported rather than repaired.

Repeatable local checks (browser fixtures must run sequentially):

```sh
bun --no-env-file apps/web/scripts/p6-dev.ts
SSO_NO_CAPTURES=1 SSO_CAPTURE_DIR=/tmp/p6-sso-functional bun --no-env-file apps/web/e2e/sso.local.ts
bun --no-env-file apps/web/e2e/sso-cross-site.local.ts
MONGO_TEST_URL='mongodb://127.0.0.1:27020/?directConnection=true' REDIS_TEST_URL='redis://127.0.0.1:16380/15' bun test packages/auth packages/db apps/api/src/mcp.integration.test.ts
bun test packages/env/index.test.ts
bun run typecheck
bun run check:llms
```

## Remaining P6 external acceptance — current checkpoint

The implementation slices above are locally verified. Phase completion still
requires the external evidence specified by plans 09–11 and 14; synthetic local
fixtures do not substitute for these gates.

| Gate | Required evidence | Environment or input needed |
| --- | --- | --- |
| Staging API and docs | Scoped REST contract matrix, proxy-origin/IP restrictions, reachable Scalar/markdown/llms pages and links | Named staging deployment and workspace with agreed test data |
| Native MCP clients | Inspector and all eleven tools against staging; supported desktop/editor OAuth flow | Staging issuer/resource and supported client installations |
| Import acceptance | 50,000 rows under five minutes; actual worker kill/restart without duplicates; staging round trip | Staging worker/queue/DB/storage access and disposable workspace |
| Private object storage | Browser presigned upload CORS, multipart export, signed private downloads and actual 24-hour lifecycle | Staging bucket configuration and lifecycle evidence |
| Mail delivery | Delivered ready-export and failure-notification emails with valid authenticated download return | Real staging mail provider and agreed recipient |
| Legacy QR and rule acceptance | Production sample scans to unchanged destinations/counts as scans; native deep-link behavior | Agreed legacy QR sample, authorized read path and devices |
| Shared authentication | New/legacy deployment coexistence, handoff/NEW_APP_URL settings, live enterprise OIDC/SAML provider configuration | Named deployments and enterprise IdP administrator/test account |
| Feature rollout/rollback | Per-feature recorded 10% → 100% rollout with rollback exercise | Deployment change authorization and cohort/monitoring evidence |

No deployment, provider connection, real mail or production mutation is claimed
by this checkpoint. Milestone 6.10's local implementation is finished; full P6
acceptance and rollout remain open.


## Completion-audit follow-up — 2026-10-16

A current-worktree audit revisited plans 09, 10, 11, 14 P6 and 16 D3 after the
SSO milestone. The remaining external gates above stay open. Local verification
was broadened across the packages rather than inferred from the auth slice.

The configured workspace runner completed **36 successful tasks** (18 typecheck
and 18 test tasks), with **720 passing tests, zero failures and 15 skips**. The
skip count includes skipped hooks: legacy quota coordination requires an explicit
opt-in, public web/redirect flows require both running services, and the 50k
import performance case is separately gated. These omissions were then exercised
explicitly: legacy quota **7 tests / 30 assertions**, cross-service link flows
**3 / 10**, and the full import suite **21 / 353**, including 50,000 rows in
**34.8 seconds locally** and actual worker-kill/checkpoint recovery for link and
QR imports. The existing 500-row checkpoint, exact-count and idempotency checks
passed. This establishes local throughput/recovery only, not staging throughput.

A coverage inspection found that the central REST scope test's name implied the
whole API while its body covered the original link routes; resource-specific
positive/lifecycle cases already covered the later additions. An independent
policy inventory now exactly matches all **49 OpenAPI operations** and verifies
missing bearer rejection, unrelated-scope rejection with `insufficient_scope`,
and passage beyond the scope boundary with the expected scope. It handles
successful empty responses and uses valid analytics/by-key query parameters.
The full REST suite passes **26 tests / 1,998 assertions**. Positive resource
lifecycle, role changes, tenant boundaries and idempotent replay remain tested
separately; reaching the scope boundary alone is not claimed as successful
resource execution.

The P6 launcher now runs the redirect service alongside web and API on port
3202. The public-flow fixture accepts `E2E_LINK_DOMAIN`, so it can exercise the
sandbox's actual `shortn.invalid` domain. Real requests verify safety-token
confirmation, web-issued password cookies accepted by redirect, and three
reports blocking subsequent access. `turbo.json` now forwards the existing
`LEGACY_QUOTA_INTEGRATION` and `IMPORT_PERFORMANCE_TEST` opt-ins; the legacy test
run through Turbo passes **82 tests**, proving its seven coordinated-quota cases
actually run through the workspace command.

| Required scope | Authoritative local evidence revisited | Remaining proof |
| --- | --- | --- |
| 09 rules, safety/health and branch recording | Redirect golden/precedence tests, rule invalidation/health/safety worker tests, core rule writes and branch dashboard evidence; workspace suites pass | Native device/deep-link acceptance in the intended environment |
| 09 link management and styled QR | Core bulk/trash/archive/quota tests, existing large-library browser reviews; renderer tests and recorded 1024px parity evidence | Production legacy QR sample |
| 10 keys and REST | Core key service plus complete 49-operation scope inventory, positive resource lifecycles, rate/idempotency/tenant tests, generated client type checks | Staging contract/proxy-origin execution |
| 10 outgoing events | Worker signature/retry/batching/log/isolation tests and existing settings-browser evidence; workspace suites pass | Real staging delivery and failure email |
| 10 MCP and docs | API SDK contract and auth browser PKCE evidence, all planned handlers/resources/prompts, generated-doc/client drift checks | Staging Inspector/tools and supported native-client OAuth |
| 11 imports/exports | Real Mongo/Redis import quota and 50k/kill-recovery evidence, legacy coexistence, retention/stream/job/ZIP tests and existing browser reviews | Staging timing and private bucket CORS/multipart/signing/lifecycle/mail |
| 16 D3 authentication | TOTP/passkey/SSO native and browser evidence, shared legacy/MCP session validation, SSO HTTPS cross-site proof | Live deployment coexistence and enterprise IdP acceptance |
| 14 P6 rollout | Default-off flags and deterministic cohorts covered by local tests | Recorded per-feature 10% → 100% rollout and rollback exercise |

The first broad diagnostic used one Bun process across package directories and
therefore omitted package-specific preloads: legacy environment and UI DOM tests
failed under that unsupported invocation. It also observed a single Redis TTL
reading of 60,003ms against a 60,000ms assertion. The configured workspace run
passed the safety-cache case without a cache implementation change. These first
results are retained in `/tmp/p6-completion-native-audit.log`; they are not
represented as a green test run. Authoritative configured results are in
`/tmp/p6-completion-workspace-tests.log`, with explicit follow-ups in
`/tmp/p6-rest-complete-contract.log`, `/tmp/p6-final-legacy-quota.log`,
`/tmp/p6-legacy-turbo-opt-in.log`, `/tmp/p6-final-import-performance.log` and
`/tmp/p6-cross-service-link-flows.log`.

API/web type checks and changed-file lint pass after the matrix/runner changes.
No product UI or design artifacts changed during this follow-up. A staging target
and disposable workspace have been requested; no live rollout or external
acceptance is inferred while that environment information is unavailable.


## Live staging readiness inspection — 2026-10-16

Read-only Forge inspection located the existing web/API/worker/redirect staging
targets and verified their latest deployments are ready on the pre-P6
`c003f2ac493502ecea31113f2e05e21283f4d609` revision. P6 remains local and
uncommitted. The target-location question is therefore resolved, but the current
remote revision cannot prove P6 behavior. The configuration-presence snapshot
and publication/disabled-first deployment sequence are recorded in
[15 staging](15-staging.md#p6-deployment-readiness--2026-10-16) and
`.impeccable/review/p6/staging-readiness.json`. Public HTTP probes returned 403
through Cloudflare; no access policy was changed or bypassed. No remote writes,
rollout, provider configuration or real email occurred. Publishing P6 and
updating the shared staging services requires owner approval.


Production packaging follow-up: the current worktree builds successfully through
`apps/web/Dockerfile`, both its build stage and complete standalone runtime,
without mounting runtime secrets. The isolated local runtime returned
`200 {"ok":true}` from `/api/health` and was then stopped. Logs are
`/tmp/p6-production-web-build.log`, `/tmp/p6-production-web-runtime-build.log`
and `/tmp/p6-production-web-runtime-health.json`. This is local image/build and
health evidence; it does not replace Forge's eventual target-platform build,
configured runtime acceptance, or staged rollout.


## Authorized staging publication — 2026-10-16

The owner authorized resuming all necessary work provided current production is
preserved, and explicitly authorized deploying staging with P6 features enabled.
The earlier deployment-approval blocker is resolved. Read-only runtime inspection
confirms the five staging services use `proj_shortn_v2_staging`, distinct staging
Redis hosts and the `shortn-v2-staging` storage bucket. Staging billing is sandbox
and worker billing remains shadow; mail is restricted to owned recipients.
Production deploy targets remain pinned to `master`. Publication targets the P6
feature branch and `staging` only; production branches, targets, routing, secrets
and data are excluded from mutation. The deployed production SHA and runtime
configuration metadata are retained as a comparison baseline.

CI integration now includes the native auth suite and explicitly opted-in legacy
quota coordination, closing the gap where the normal checks job skipped those
service-dependent tests. All eighteen workspace lint tasks passed before
publication (existing legacy warnings remain warnings).


### 2026-10-17 authorized staging deployment checkpoint

P6 was published in PR #438 targeting `staging`. The existing production branch and deployments remain unchanged. CI passed all four jobs at `a5e0b2e`; the large campaign fixture and exhaustive QR rendering test now have explicit 30-second bounds instead of the default five seconds.

The actual staging storage bucket passed authenticated reads, signed download privacy (200 signed / 403 unsigned) and a seven-MiB multipart round trip. Its gateway rejects browser CORS preflights and ignores conditional PUT. `IMPORT_UPLOAD_PROXY_ENABLED=1` provides a staging-only authenticated, same-origin CSV upload fallback: bodies are bounded to ten MiB, jobs are actor/workspace scoped, an atomic permanent claim prevents concurrent or later overwrites, and the worker checks the source hash before snapshotting. Failed/interrupted uploads require a fresh job. Direct presigned upload remains the default for compatible gateways.

Staging-only API/MCP/webhook secrets and a 10% initial rollout were saved after environment-schema validation; imports, exports and QR exports are enabled. Runtime application and acceptance are still pending at this checkpoint. No production setting was changed.


### 2026-10-17 live P6 acceptance and queue correction

PR #438 merged as `24dc2c6`; all five staging services deployed that exact commit and the final feature CI run (`39006731693`) passed all four jobs. The staging Worker version is `ebcea674-dc27-4848-994a-5d886886dc54`. Production remains at `6b49d03`. Browser checks authenticated an isolated Enterprise fixture and opened Links, QR, imports, workspace exports, API keys, webhooks, SSO and sign-in methods (all HTTP 200, zero page errors). REST serves all 49 operations; all 12 currently advertised MCP tools, both resources and the report prompt passed live calls.

Live background-job acceptance exposed inherited ioredis command timeouts on BullMQ blocking consumers. All nine queue factories now use `blockingQueueRedis`, which removes the inherited command timer while preserving the bounded producer connections and connection establishment settings. A real Redis QR regression waits beyond a bounded parent's command timer before enqueueing work: it fails on the previous implementation and passes after the correction. This correction still needs publication/deployment at this checkpoint; queued QR artifact acceptance and the larger import tests are not yet complete.


### 2026-10-17 staging enabled-feature acceptance

PR #439 merged as `1402b9c`. Its CI run (`39007383330`) passed all four jobs, and the full real-service worker suite passed 123 tests (the optional local 50k benchmark was skipped because the live staging workload was tested). Staging API/MCP/webhook cohorts were raised from 10 to 100 and applied. The API master switch was applied off and restored: authenticated REST returned 404 while off, 200 after restore, and health stayed 200. Production master remains `6b49d03`.

A real browser uploaded a 4,116,689-byte CSV containing 50,000 rows through the same-origin fallback (204, zero browser errors). Validation plus commit completed in 119,854 ms; all 50,000 records and cache warm checkpoints matched. A separate 5,000-row import was interrupted with SIGKILL on the verified staging worker container after a 500-row checkpoint (a second chunk committed before the signal arrived). The restarted worker waited for its lease, resumed, and completed 5,000 distinct keys with no loss or duplicates in 330,259 ms. The 50,000-link library passed 25-row pagination, searchable tag filtering (5,000 matches), selection across pages/filters and 390px layout without horizontal overflow or page errors.

All 12 MCP tools passed live API-key calls. A native public client also passed real registration, browser workspace selection and consent, PKCE token exchange, OAuth-authenticated MCP and refresh. SVG, PNG and PDF exports downloaded with signed 200 responses and unsigned 403 responses; the PNG decoded to the staging host. Large link CSV (55,005 rows, 8,789,186 bytes) and workspace archive (39,528,998 bytes, 18 files) completed via the deployed workers and private bucket. The owned fixture's non-allowlisted email was suppressed by staging mail controls. Live delivery to an actual inbox, external enterprise IdP credentials and physical-device deep links remain external acceptance checks; no successful test is claimed for them here.

The final worker log review exposed `0002-workspaces` verification incorrectly counting native rows without legacy ownership fields as orphans. The correction accepts such records only when their explicit workspace exists and is not the orphan workspace; known/unknown legacy-owner mismatches and dangling workspace references still fail. Four real Mongo regressions cover these cases (the valid-native case fails before the change). Read-only verification against staging now succeeds with zero discrepancies and recognizes 55,013 native links. Publication and deployed continuous-migration verification of this final correction are pending at this checkpoint.


### 2026-10-17 final hostname/proxy acceptance correction

PR #440 merged as `05717a7c` after CI (`39008358803`) passed all four jobs and all 42 real-service database tests passed. Staging continuous migration verification now reports no discrepancy. An actual 5,000-row sample from the deployed CSV export re-imported with matching URLs, titles and tags in 32,037 ms (new keys were generated within the staging namespace). Signed downloads also reject expired signatures (403).

Cleanup exposed an inherited staging configuration mismatch: the web/worker/redirect `LINK_DOMAIN` still used `shortn.at`. These three staging targets now use `staging.shortn.at`; the API already did. Production settings are untouched. Fresh imports now store staging-domain links, but an external redirect check exposed the reverse proxy rewriting the standard `X-Forwarded-Host`. The redirect origin returned 302 when called directly while the public route returned 404.

The edge now overwrites and forwards `X-Shortn-Forwarded-Host`. Redirect and authenticated public-auth flows prefer that dedicated header, retaining the standard header as a compatibility fallback. Redirect host authority still requires the existing edge secret; custom-domain web authority still requires its existing bio secret and active-domain validation. The regression simulating a rewritten standard host fails before the correction; the 32 redirect/edge unit tests and 30 lint/typecheck tasks pass afterward. Live deployment and public redirect re-check are pending at this checkpoint.


### 2026-10-17 public-route and QR-domain acceptance

PR #441 merged as `bbcca87e`; CI (`39009344365`) passed all four jobs after one legacy font-build rerun. The staging edge version is `5de3a11b-376a-4300-a75d-0f849bbf8c86`. Public staging imports now redirect to their expected destination, and a real browser passed the wrong-password and correct-password gate flows with zero page errors. The reverse proxy host correction is deployed on staging.

After a collision preflight and private rollback backup, 2,687 restored staging links and 41 existing workspace defaults were rebased from the production root hostname to `staging.shortn.at`; both old/new staging cache namespaces were invalidated. Production data/configuration was not changed. Task-owned load-test fixtures were excluded from that rebase and are being cleaned up separately.

The QR scan-count check exposed a separate native-creation bug: `createQr` rendered the configured host but its backing document omitted `domain`, allowing the legacy derivation helper's production default to be persisted. Creation now sets `domain: ctx.linkDomain` before derivation. A real Mongo regression verifies lookup on both staging and local-port hosts and retention through edits; it fails before the correction and passes afterward (all nine QR/campaign/analytics tests pass). All 30 affected lint/typecheck tasks also pass. Live API/QR creation and scan-count acceptance for this correction are pending at this checkpoint.
