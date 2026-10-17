# 15 — Staging environment & branch flow

Decided 2026-10-09. "Forge" here is the self-hosted container platform at `forge.denizlg24.com` (GitHub App `denizlg24-forge`), managed through the `denizlg24` MCP. Where earlier plans say "Forge daemon/site", read "Forge container/site".

## Branch flow

- `master` = production. Hotfixes land here and are merged into `staging` immediately.
- `staging` = integration branch, auto-deployed to the staging Forge site. All rebuild PRs target `staging`.
- Promotion `staging → master` happens **per phase**, when that phase's gate in [14](14-cutover-and-rollout.md) has passed on staging, never as one final merge. New services land on `master` dark (edge Worker route / feature flag), so a promotion never changes user-facing behavior by itself.
- First promotion: P1 foundation (#416) together with the production Forge change to build/run from `legacy/`.

## Staging site

| Item     | Value                                                                                                                                                                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosts    | `staging.shortn.at` (root/redirects/marketing), `app.staging.shortn.at`, `api.staging.shortn.at`, `*.staging.shortn.at` bio handles (needs Advanced Certificate or a second-level wildcard cert at Cloudflare)                                                                                  |
| Branch   | `staging` (auto-deploy)                                                                                                                                                                                                                                                                         |
| Database | separate database **and** user, never the production database. Option A: database `shortn_staging` on the existing `rs0` with a user scoped to it (cheap; data is tiny). Option B: its own container. Restored from a production dump, refreshed weekly; PII (emails, IPs) scrubbed on restore. |
| Redis    | `shortn-staging-cache` + `shortn-staging-durable` on the Forge host (13), wired as `REDIS_CACHE_URL`/`REDIS_DURABLE_URL`                                                                                                                                                                        |
| Search   | Meilisearch with `staging_` index prefixes or its own instance                                                                                                                                                                                                                                  |
| Billing  | Polar **sandbox** org and products                                                                                                                                                                                                                                                              |
| OAuth    | separate GitHub OAuth app (single callback URL); Google: add staging redirect URIs to a separate client                                                                                                                                                                                         |
| Email    | Resend with a restricted sending domain/allowlist so staging never emails real customers                                                                                                                                                                                                        |
| Robots   | `noindex`, basic auth or Cloudflare Access in front of `app.`/marketing                                                                                                                                                                                                                         |

## Environment variables (staging vs production)

**Copy from production unchanged:** `WEB_RISK_API_KEY`, `NEXT_PUBLIC_GOOGLE_FONTS_API_KEY`, `PINATA_JWT`, `PINATA_GATEWAY` (legacy uploads only).

**Must be different on staging (never copy):**

| Variable                                                                                                 | Staging value                                                                       |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `MONGODB_KEY`                                                                                            | staging database + staging user                                                     |
| `BETTER_AUTH_URL`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`                                                     | staging URLs                                                                        |
| `BETTER_AUTH_SECRET`, `AUTH_SECRET`, `INTERNAL_API_SECRET`, `CRON_SECRET`, `EMAIL_TOKEN_SUFFIX`          | freshly generated (sessions/tokens must not be valid across environments)           |
| `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`                                                         | staging OAuth apps                                                                  |
| `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_ENVIRONMENT=sandbox`, `FREE/BASIC/PLUS/PRO_PLAN_ID` | Polar sandbox                                                                       |
| `MEILI_URL`, `MEILI_MASTER_KEY`, `MEILI_INDEX_LINKS`, `MEILI_INDEX_QR_CODES`                             | staging instance or prefixed indexes                                                |
| `SCHEDULER_URL/USERNAME/PASSWORD`                                                                        | separate credentials (or disabled: its callbacks would hit whatever URL it's given) |
| `SLACK_WEBHOOK_URL`                                                                                      | a staging channel                                                                   |
| `RESEND_API_KEY`                                                                                         | restricted key / sending domain                                                     |

**Dead, drop on staging (and later in prod):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`, `QSTASH_*`, `VERCEL_OIDC_TOKEN`, `ATLAS_SEARCH_INDEX_*`, `LEVEL_ONE_UPGRADE_ID`, `LEVEL_TWO_UPGRADE_ID`, `WEBMAIL_USER/PASS` (once nodemailer is removed).

**New for the rebuild (added as each phase lands):** `REDIS_CACHE_URL`, `REDIS_DURABLE_URL`, `LINK_ACCESS_SECRET`, `CONFIRMATION_TOKEN_SECRET`, `IP_HASH_SECRET`, `API_KEY_PEPPER`, `R2_*`, `CF_API_TOKEN`, `CF_ZONE_ID`.

## Containers (decided 2026-10-09)

Every deployable app is its own Docker image and Forge `dockerfile` target, to keep Forge resource usage predictable:

| Target                          | rootDirectory   | Dockerfile                 | Hosts (prod / staging)                                    |
| ------------------------------- | --------------- | -------------------------- | --------------------------------------------------------- |
| legacy app                      | `legacy`        | `legacy/Dockerfile`        | `shortn.at` / `staging.shortn.at`                         |
| web (dashboard, marketing, bio) | `apps/web`      | `apps/web/Dockerfile`      | `app.shortn.at` + `*.shortn.at` / `app-staging.shortn.at` |
| redirect                        | `apps/redirect` | `apps/redirect/Dockerfile` | `shortn.at` (single-segment paths) / `staging.shortn.at`  |
| api                             | `apps/api`      | `apps/api/Dockerfile`      | `api.shortn.at` / `api-staging.shortn.at`                 |
| worker                          | `apps/worker`   | `apps/worker/Dockerfile`   | none (no ingress)                                         |

Build context is always the repository root; build-time env arrives through Forge's `forge-env` build secret; runtime images are slim (`node:24-trixie-slim` for Next, `oven/bun` slim for Bun services). Redis (×2 per environment) runs as Forge-host units (`forge-redis@`, 13) and Meilisearch as a pi-cloud resource, not app images.

## Env file

`.env.staging` at the repo root (gitignored) is the working copy for the staging target: URLs and staging-only secrets pre-generated, blanks for the values that need new accounts (staging DB user, OAuth apps, Polar sandbox, restricted Resend key). Applied to Forge with `forge_env_apply` once filled.

## P4 acceptance wiring — 2026-10-11

The `shortn-web-staging` and `shortn-api-staging` Forge targets are deployed with active TLS at `app-staging.shortn.at` and `api-staging.shortn.at`. The staging Worker has `WEB_ORIGIN` and `DASHBOARD_HANDOFF=1`; legacy has `NEW_APP_URL`, and redirect/web share the link-access and confirmation secrets. Staging billing writes target Polar sandbox; the worker remains in shadow mode.

The API has its own Polar webhook endpoint and signing secret. In the gitignored `.env.staging`, `POLAR_WEBHOOK_SECRET` still belongs to legacy; `API_POLAR_WEBHOOK_SECRET` is the API override. Do not overwrite one target's secret with the other's. The current shared link secrets are also retained in that file. Forge stores the applied service configuration.

OAuth placeholders are unset on the web target, with real OAuth setup deferred to production by the owner. The web mail allowlist is restricted to owned recipients; temporary acceptance aliases are removed after testing.


## P6 deployment readiness — 2026-10-16

Authenticated read-only Forge inspection confirms the four staging targets are
present and ready: `shortn-web-staging`, `shortn-api-staging`,
`shortn-worker-staging` and `shortn-redirect-staging`. Every latest deployment
still runs `c003f2ac493502ecea31113f2e05e21283f4d609` from `staging` (2026-10-12).
The P6 feature branch has the same HEAD; its implementation is uncommitted in
the local worktree. Those running services therefore cannot establish P6
acceptance. Their target/deployment IDs and configuration-presence snapshot are
recorded in `.impeccable/review/p6/staging-readiness.json`, without secret values.

The targets auto-deploy from `staging`. Publishing/merging P6 and updating these
shared services is a separate operator step requiring owner approval. No remote
configuration, deployment, resource, domain or rollout was changed by this
readiness inspection. Public web login, API health and OpenAPI probes returned
HTTP 403 through Cloudflare from the current client; that establishes neither
application failure nor P6 behavior. Use the approved staging access path for
acceptance rather than weakening access controls.

P6 master switches, cohort percentages and webhook recoverable-secret keys are
not explicitly configured on the inspected web/API/worker targets. API also
lacks explicit Redis/API-key/MCP and private-export storage configuration; worker
lacks explicit private-export storage configuration. Web already has storage
variable metadata. Presence alone does not prove bucket privacy, CORS,
multipart/signing or lifecycle behavior. Worker MongoDB is resource-bound, so
`hasValue: false` on its binding/template is not evidence of missing credentials.
Preserve the existing auth/link/confirmation secrets and API-specific Polar
webhook override during any update.

Concrete deployment sequence after approval:

1. Publish the reviewed P6 implementation/test/docs changes on `feat/p6-platform`,
   excluding the local graph cache and pre-existing local ignore changes. Run the
   configured CI gates and review a PR targeting `staging`.
2. Merge to `staging`; watch all four Forge builds reach the exact merged SHA.
   Keep P6 features disabled by default while verifying service health and the
   new auth dependency against existing staging sessions.
3. Deploy `shortn-edge-staging` with
   `bun run --cwd apps/edge deploy:staging`. P6 adds root docs/llms/OpenAPI and MCP
   consent/discovery routing; Forge container deployment does not publish this
   separate Cloudflare Worker. Production Worker configuration stays untouched.
4. Apply the additive indexes and dry-run any OAuth resource-registry migration
   against the staging database before accepting new keys/providers/grants.
5. Configure the intended staging issuer/resource origins, distinct API pepper
   and shared webhook encryption key, private storage and restricted mail. Verify
   the storage/mail gates before enabling their features. Configure exact trusted
   enterprise IdP origins only for the agreed IdP test setup.
6. Use a disposable staging workspace for the contract, native-client, import,
   storage, mail and identity acceptance matrix in plan 19. Record actual
   deployment SHAs, results and rollback evidence. Only then exercise the planned
   per-feature 10% → 100% rollout; local fixture results do not satisfy it.

The earlier request for a staging target is resolved by this inspection. A
staging test workspace, access path, live IdP test setup and deployment approval
remain to be supplied or established before their dependent operations.


### 2026-10-17 authorized staging deployment checkpoint

P6 was published in PR #438 targeting `staging`. The existing production branch and deployments remain unchanged. CI passed all four jobs at `a5e0b2e`; the large campaign fixture and exhaustive QR rendering test now have explicit 30-second bounds instead of the default five seconds.

The actual staging storage bucket passed authenticated reads, signed download privacy (200 signed / 403 unsigned) and a seven-MiB multipart round trip. Its gateway rejects browser CORS preflights and ignores conditional PUT. `IMPORT_UPLOAD_PROXY_ENABLED=1` provides a staging-only authenticated, same-origin CSV upload fallback: bodies are bounded to ten MiB, jobs are actor/workspace scoped, an atomic permanent claim prevents concurrent or later overwrites, and the worker checks the source hash before snapshotting. Failed/interrupted uploads require a fresh job. Direct presigned upload remains the default for compatible gateways.

Staging-only API/MCP/webhook secrets and a 10% initial rollout were saved after environment-schema validation; imports, exports and QR exports are enabled. Runtime application and acceptance are still pending at this checkpoint. No production setting was changed.


### 2026-10-17 live P6 acceptance and queue correction

PR #438 merged as `24dc2c6`; all five staging services deployed that exact commit and the final feature CI run (`39006731693`) passed all four jobs. The staging Worker version is `ebcea674-dc27-4848-994a-5d886886dc54`. Production remains at `6b49d03`. Browser checks authenticated an isolated Enterprise fixture and opened Links, QR, imports, workspace exports, API keys, webhooks, SSO and sign-in methods (all HTTP 200, zero page errors). REST serves all 49 operations; all 12 currently advertised MCP tools, both resources and the report prompt passed live calls.

Live background-job acceptance exposed inherited ioredis command timeouts on BullMQ blocking consumers. All nine queue factories now use `blockingQueueRedis`, which removes the inherited command timer while preserving the bounded producer connections and connection establishment settings. A real Redis QR regression waits beyond a bounded parent's command timer before enqueueing work: it fails on the previous implementation and passes after the correction. This correction still needs publication/deployment at this checkpoint; queued QR artifact acceptance and the larger import tests are not yet complete.
