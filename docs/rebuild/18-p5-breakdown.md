# 18 — P5 task breakdown

P5 delivers the new public bio renderer, bio subdomains and custom domains described in [07](07-domains-and-subdomains.md), [08](08-link-in-bio.md) and [14](14-cutover-and-rollout.md).

## Entry checkpoint — 2026-10-11

P4 staging acceptance is complete, and its fixes are merged into staging. Local checks, deployed flows and real provider acceptance are recorded in [16](16-p4-breakdown.md) and its audit. The owner approved visuals, waived the seven-day observation period and deferred OAuth configuration/tests to production. P5 starts from the accepted staging implementation; production promotion and switches remain a separate operator rollout.

## Implementation slices

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| 5.1 | Public renderer for typed blocks, constrained themes/presets, shared editor preview and internal handle route | Empty, short and 20+ link pages; long titles; links with/without images; desktop/mobile; en/pt/es glyph coverage; accessible contrast and keyboard interaction. Preserve migrated content and legacy fonts. |
| 5.2 | Draft/publish/version services, block editing and scheduling, inline URL shortening | Permission/entitlement checks; stable block IDs; atomic publish; restore from last 20 versions; failed saves retain drafts. Published content and preview use the same renderer. |
| 5.3 | Handle resolution, aliases and edge host routing; gated `/b/{slug}` redirects | Reserved labels and grandfathered handles; old aliases resolve to the current page; host headers are authenticated at the origin; staging uses its documented single-level hosts. Exhaustive legacy slug redirect comparison. |
| 5.4 | Cached public delivery, invalidation, SEO/OG and bio view analytics | Publish invalidates origin/edge caches; canonical handle/custom domain; noindex; isolated view ingestion; tracked link clicks; consent-gated embeds; minimal client JavaScript. |
| 5.5 | Custom-domain entitlement/add-on, provider adapter, polling jobs and Settings → Domains | Pending/active/error states; exact DNS instructions; hostname and TLS both active before serving; workspace isolation; retry/backoff; removal preserves recoverable links. |
| 5.6 | Rollout acceptance and owner notifications | Review 50 representative migrated pages side by side; 100% legacy slugs resolve through 301s; one real custom domain in production for at least seven days; verify fallback to direct `/b/{slug}` rendering. |

## First implementation target

Start 5.1 with the existing migrated bio schema and service reads. Build the public renderer and content-extreme fixtures before adding host routing. Reuse that component in the dashboard preview. The legacy public layout is migration evidence, not the visual design target.

## P4 acceptance and production follow-up

External email, Polar sandbox lifecycle/history/invoices, legacy-host handoff, legacy bio rendering, public-link flows and all 141 localized page renders passed. The owned sandbox subscription reconciled without drift; two pre-existing orphan sandbox records are documented and preserved. OAuth configuration/callback tests remain deferred to production setup. Production routing and billing switches remain separate from P5 development. The waived P4 observation period does not change P5 custom-domain acceptance.

## Operator steps

Production routing changes, owner notification sends and paid provider provisioning follow review of the concrete staged result. Keep `/b/*` on the existing renderer until the replacement has passed acceptance; retain direct rendering as the rollback path.

## Development implementation — 2026-10-12

**P5 development is complete (slices 5.1–5.5).** The rollout gates in 5.6 remain open and are tracked separately from the staging merge.

- The public route is `apps/web/src/app/%5Fbio/[handle]` (Next escapes the underscore to expose `/_bio`). Public pages and dashboard previews share `BioRenderer`. Eight block types, 12 presets, 16 self-hosted fonts, contrast correction, legacy font/align preservation, SEO, generated OG images and tracked QR codes are included. Only embeds and the privacy-aware view beacon require client components on public pages.
- The editor supports pointer/keyboard ordering, visibility, UTC schedules, inline shortening, theme controls, localized copy, autosave with optimistic revisions, explicit publishing and restore from the last 20 publications. Publication, snapshot retention and the invalidation outbox commit in one replica-set transaction. Existing form URLs move to the new editor when delivery is enabled. Managed drafts/publications are excluded from M8/M12 continuous overwrites.
- Authenticated edge headers select handle/custom-domain pages; forwarded cookies and router headers cannot vary public HTML. Old slugs resolve through page IDs, and redirects can be switched off independently. Handle aliases are conservatively retained after 30 days; automatic low-traffic handle release is deliberately deferred rather than risking shared/printed addresses.
- Tagged Next Data Cache entries hold published content for 60 seconds. Identity/entitlement checks remain live. This uses `unstable_cache` and `revalidateTag`, because the accepted P4 dashboard still uses `force-dynamic`; enabling Cache Components globally would require a separate dashboard migration. Edge HTML has a 60-second TTL and stale-while-revalidate. The durable outbox retries origin invalidation and Cloudflare URL purges and schedules the next block transition. View events use the clicks stream but separate Mongo storage and deduplication; they never increment link-click counters. Bio attribution survives safety/password gates.
- Domains reserve an add-on slot before provider writes. Provisioning is leased, recoverable by hostname, bounded to 72 hours, and requires both hostname and TLS readiness. Settings exposes DNS validation, retry, link creation/assignment, removal and collision-aware recovery. Keys are scoped to domains. Polar products marked `shortn_addon=custom_domains` mirror into separate add-on subscriptions. Domain-ready email uses a durable, idempotent notification job.

### Configuration and rollback

All new routing/provider switches default to `0`. Keep production switches unchanged until 5.6 acceptance.

| Variable | Purpose |
| --- | --- |
| `BIO_DELIVERY_ENABLED` | Enable the new public renderer and dashboard editor navigation. |
| `BIO_SUBDOMAINS` | Production wildcard handle routing. Keep `0` on staging/local hosts. |
| `BIO_LEGACY_REDIRECTS` | Enable `/b/{slug}` 301s after exhaustive parity review. With delivery `1` and redirects `0`, `/b/{slug}` renders directly through the new renderer. With delivery `0`, the edge retains legacy ownership. |
| `BIO_WEB_ORIGIN`, `BIO_INTERNAL_SECRET` | Authenticated redirect proxy and worker origin invalidation. Use the same distinct secret on participating services/edge. |
| `BIO_API_ORIGIN` | Public view-beacon API origin. API delivery also requires Redis URLs, `IP_HASH_SECRET` and `PUBLIC_ORIGIN`. |
| `DOMAIN_WRITES` | Enable domain creation and provisioning jobs after provider setup. |
| `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` | SaaS hostname API and purge access; required by the provisioning worker. |
| `DOMAIN_CNAME_TARGET` | The operator-configured SaaS fallback hostname shown in DNS instructions. |
| `POLAR_DOMAIN_PRODUCT_ID` | Product in the configured Polar environment, with metadata `shortn_addon=custom_domains`; one active subscription permits one domain. Checkout also requires `BILLING_WRITES=1`. |
| `MAIL_ALLOWLIST` | Restrict staging domain-ready notifications to approved recipients. |

Apply the registered indexes with `bun run db:indexes` against the intended environment before enabling services. New collections use the physical-name registry. Mongo must be a replica set for publication transactions. Configure Cloudflare for SaaS fallback routing and wildcard Worker routes separately; application code does not change DNS or deploy routing.

### Repeatable checks and local sandbox

- `bun run typecheck`, `bun run lint`, `bun run test` cover the workspace checks.
- `MONGO_TEST_URL='mongodb://127.0.0.1:27017/?replicaSet=rs0' REDIS_TEST_URL='redis://127.0.0.1:6390' bun test packages/core/bio/ packages/core/domains/ packages/core/links/ apps/edge/ apps/redirect/src/app.test.ts` covers real transactions, permissions, concurrent revisions, versions, aliases, host isolation, add-on/TLS lifecycle, scoped keys and view ingestion in temporary databases.
- `bun --no-env-file apps/web/e2e/bio.browser.ts` checks a local server on port 3100 with ephemeral fixture routes: 18 mobile/desktop, en/pt/es, 0/2/25-link cases, long text, thumbnails, keyboard access and embed consent. The fixture route is removed afterward.
- `bun --no-env-file apps/web/scripts/p5-dev.ts` seeds the isolated loopback database `shortn_p5_dev`, then runs web/redirect/API/worker on 3100/3102/3103/3104. Start local Mongo and Redis with `docker compose -f docker-compose.dev.yml up -d mongo redis-cache redis-durable` first. It reads base development configuration from `.env.staging`, overrides all data origins to local services, disables billing/provider writes, and drops outgoing email through the allowlist. Test credentials and direct URLs are written to `/tmp/shortn-p5-login.json` with owner-only permissions. Re-running rotates the test password and preserves editor changes. `bun --no-env-file apps/web/e2e/p5.local.ts` checks the seeded login, editor publication, public page, QR and redirect.
- `bun apps/redirect/scripts/bio-parity.ts` is a read-only exhaustive source-data comparison. Set `MONGODB_URL`, `MONGODB_DB`, `PUBLIC_ORIGIN` and `BIO_SUBDOMAINS`; optionally set `BIO_PARITY_ORIGIN` to exercise every `/b/{slug}` URL with and without a trailing slash and check 301 locations. It excludes unpublished new drafts.

Local checks do not satisfy 5.6: the owner still needs to review 50 migrated pages side by side, accept exhaustive production slug parity, exercise rollback, approve owner migration notifications, and observe a real production custom domain for seven days. No production switches or provider resources were changed by this implementation.

### Verification recorded

The production web build, all 15 workspace typecheck/lint tasks and all 30 workspace test tasks passed. The expanded Mongo/Redis integration run passed 46 tests; the final redirect suite passed 11 tests, including local port preservation. Renderer browser coverage passed all 18 cases, and the persistent sandbox passed login → dashboard → editor → publish → public bio → tracked redirect, including QR rendering and consent gating. The UI detector reported no findings. Existing legacy lint warnings remain unchanged.

### Editor and large-library acceptance — 2026-10-12

The accepted editor uses a visual drag/drop canvas with stable section dimensions and focused in-page controls, with a shared live preview in every settings view. Link collections support vertical, small/large square and image-card layouts, image/text content, corners, image fitting, surfaces, borders, spacing, arrows and independently configurable pagination/counts. Profile images, section images, link thumbnails and favicons are uploads. Drafts, publication and version restoration remain available. Preset selection reflects the current theme, and older draft values remain controlled throughout editing.

Bio and campaign link selection reuse the main Links page controls: searchable multi-tag filters, grouping, server pagination, compact selected-tag labels and selections retained across pages and filters. Bio additions are bounded by the section's remaining 1,000-link capacity. Campaigns apply one set of UTM parameters to up to 500 selected links per save, preflight ownership and variant limits, skip existing variants on bulk retries, and report partial saves if a write fails. AGENTS.md now makes thousands-of-links usage an explicit design requirement.

Final root checks passed all 15 typecheck tasks, 15 lint tasks and 30 test tasks. The studio browser regression covered 1,005 tagged links, the 1,000-link section cap, uploads, stable drag geometry, theme/preset state, live side previews and mobile bounds. The campaign regression covered 1,005 tagged links, grouping, cross-page/filter selection, 44 persisted variant writes, duplicate retries, the 500-link operation cap and foreign-target preflight with no partial writes. Both browser suites recorded no console/page errors; desktop/mobile captures were inspected. These checks complete development acceptance; they do not close the production gates above.
