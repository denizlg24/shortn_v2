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
| Redis    | `shortn-staging-cache` + `shortn-staging-durable` on the Forge host (13), wired as `REDIS_CACHE_URL`/`REDIS_DURABLE_URL`                                                                                                                                                                                                                                                               |
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

| Target | rootDirectory | Dockerfile | Hosts (prod / staging) |
|---|---|---|---|
| legacy app | `legacy` | `legacy/Dockerfile` | `shortn.at` / `staging.shortn.at` |
| web (dashboard, marketing, bio) | `apps/web` | `apps/web/Dockerfile` | `app.shortn.at` + `*.shortn.at` / `app-staging.shortn.at` |
| redirect | `apps/redirect` | `apps/redirect/Dockerfile` | `shortn.at` (single-segment paths) / `staging.shortn.at` |
| api | `apps/api` | `apps/api/Dockerfile` | `api.shortn.at` / `api-staging.shortn.at` |
| worker | `apps/worker` | `apps/worker/Dockerfile` | none (no ingress) |

Build context is always the repository root; build-time env arrives through Forge's `forge-env` build secret; runtime images are slim (`node:24-trixie-slim` for Next, `oven/bun` slim for Bun services). Redis (×2 per environment) runs as Forge-host units (`forge-redis@`, 13) and Meilisearch as a pi-cloud resource, not app images.

## Env file

`.env.staging` at the repo root (gitignored) is the working copy for the staging target: URLs and staging-only secrets pre-generated, blanks for the values that need new accounts (staging DB user, OAuth apps, Polar sandbox, restricted Resend key). Applied to Forge with `forge_env_apply` once filled.
