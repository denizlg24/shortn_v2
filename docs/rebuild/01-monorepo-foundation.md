# 01 — Monorepo & Foundation

Goal: a clean workspace that new code lives in from day one, with the legacy app still deployable from the same repo until P7.

## Layout

```
shortn/
├─ legacy/                 # current app, moved as-is (git mv); still deployed on Forge until P7
├─ apps/
│  ├─ web/                 # Next.js 16: dashboard (app.), marketing (root), bio pages (*.)
│  ├─ redirect/            # Bun + Hono: link resolution only (03)
│  ├─ api/                 # Bun + Hono: REST v1 + MCP + webhooks in (10)
│  └─ worker/              # Bun: BullMQ jobs + Redis Stream consumers (04, 06, 09, 11)
├─ packages/
│  ├─ db/                  # Mongo client, zod schemas, typed repositories, indexes, migrations
│  ├─ core/                # domain services: links, qr, bio, workspaces, billing, domains, safety
│  ├─ redis/               # client, key builders, cache helpers, rate limiter, stream helpers
│  ├─ auth/                # better-auth server config + client (shared by web and api)
│  ├─ billing/             # Polar client, product→entitlement map, webhook handlers
│  ├─ ui/                  # design system (tokens + components), see 12
│  ├─ emails/              # react-email templates (en/pt/es)
│  ├─ i18n/                # message catalogs + helpers, shared by web, emails, redirect pages
│  ├─ config/              # tsconfig bases, eslint flat config, prettier
│  └─ env/                 # zod env schemas per app (fail fast on boot)
├─ docs/rebuild/
├─ turbo.json
└─ package.json            # bun workspaces
```

**Why `legacy/` instead of a new repo:** shared CI and a single history. Migrations can import legacy model shapes for verification. Deleting the folder at P7 is one PR.

`git mv` everything currently at the root into `legacy/` in a single commit. Fix the Forge deploy script's working directory in the same PR. Verify the deploy on staging before merging.

## Tooling

| Concern                   | Choice                                                                                      | Notes                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Package manager / runtime | bun (workspaces), Node 24 for Next                                                          | bun runs scripts, tests and the Hono services; Next runs on Node (`next start`, standalone output). |
| Task runner               | Turborepo                                                                                   | remote cache optional; `turbo run lint typecheck test build --filter=...[origin/master]` in CI      |
| TypeScript                | TS 6 strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                       | shared base in `packages/config`                                                                    |
| Lint/format               | ESLint 10 flat config + typescript-eslint + react-hooks 7, Prettier 3                       | Biome considered. Rejected only because of Next/React-hooks rule coverage, which is a preference.   |
| Validation                | **zod 4** everywhere (env, API, forms, DB docs)                                             | removes zod 3                                                                                       |
| Tests                     | `bun test` for unit/integration; Playwright for e2e; mongo + redis via docker compose in CI | jest removed                                                                                        |
| Git hooks                 | husky + lint-staged (keep)                                                                  |                                                                                                     |
| Releases                  | keep release-drafter. Replace `auto-branch`/`sync-branch-status` only if still used.        |                                                                                                     |

## Dependency plan

Starting state: 6 open Dependabot PRs. **Don't merge them into legacy.** Close them with a link to this plan once `legacy/` is frozen. The exception is security patches (`npm_and_yarn` group #411), which should merge into legacy now.

New stack (pin exact versions at scaffold time; take latest stable):

- **Keep:** next 16, react 19.2 (react + react-dom on the _same_ version), better-auth + `@polar-sh/better-auth`, `@polar-sh/sdk`, next-intl 4, tailwindcss 4, shadcn/ui (copied into `packages/ui`), radix (via shadcn), `@tanstack/react-table`, react-hook-form + resolvers, sonner, cmdk, vaul, date-fns 4, nanoid, isbot, ua-parser-js 2, qr-code-styling (client) , @sentry/nextjs + @sentry/bun, resend + @react-email/components.
- **Add:** `mongodb` (native driver, see decision below), `ioredis`, `bullmq`, `hono` + `@hono/zod-openapi` + `@scalar/hono-api-reference`, `@modelcontextprotocol/sdk`, `@aws-sdk/client-s3` (R2), `@tanstack/react-query` (dashboard client data, replaces SWR), `meilisearch` (JS client, kept), `motion` (one animation lib), `recharts` 3 _or_ `visx` (decided in 12), `papaparse` (CSV), `jose`.
- **Remove:** `mongoose`, `@auth/mongodb-adapter`, `jsonwebtoken` + `@types/jsonwebtoken` (use jose), `bcryptjs` (use better-auth's or `Bun.password`/argon2id), `framer-motion`, `gsap`, `ogl`, `hamburger-react`, `canvas`, `qr-code-styling-node` (server QR rendering moves to `qrcode` SVG output), `jsdom`, `parse5`, `json2csv` alpha, `pinata`, `ip2location-io-nodejs` (Cloudflare geo headers), `nodemailer` (Resend only), `swr`, `devicons-react`, `react-icons` (lucide + simple-icons only), `next-share`, `country-data-list` _or_ `i18n-iso-countries` (keep one; prefer `Intl.DisplayNames` + flags), `jsvat`/`libaddress-validator`/`postcode-validator` (Polar collects billing details), `require-in-the-middle`, `@vercel/otel`, `@types/*` that live in `dependencies`.
- Dependabot config: grouped weekly updates per workspace, auto-merge patch for dev deps when CI is green.

### Decision: Mongo access layer: **native driver (decided 2026-10-09)**

| Option                                                          | Pros                                                                                                                                                                                   | Cons                                                                                                                                                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Native `mongodb` + zod schemas + repositories** (recommended) | One client shared with better-auth. Explicit queries, no hidden `save()` races. Types derive from zod. Works unchanged in Bun services. Time-series collection support is first class. | We write index definitions and validation ourselves (we want that anyway).                                                                                                                                  |
| Mongoose 9                                                      | Familiar. Model code can be ported.                                                                                                                                                    | Second connection pool alongside better-auth's client (the cause of the recent topology bug, #412). Document `save()` patterns invite the lost-update bugs we are fixing. Heavier in the redirect hot path. |

## `packages/db` design

- `client.ts`: a single `MongoClient` per process with `maxPoolSize` tuned per app (redirect: 20, web: 30, worker: 10). It's exported lazily. better-auth receives the same `Db`.
- `schemas/*.ts`: one zod schema per collection (the doc shape) + `Insert`/`Update` derived types.
- `collections.ts`: typed accessors `db.links()`, `db.clickEvents()`, …
- `indexes.ts`: declarative index list per collection. A `bun run db:indexes` script diffs and creates indexes (`createIndexes` is idempotent). It never drops automatically; it prints drop suggestions.
- `repositories/*.ts`: the only place queries are written. Services in `packages/core` depend on repositories, not collections.
- `migrations/`: see [02](02-data-model-and-migrations.md).

## Env & secrets

- `packages/env` exports `webEnv`, `redirectEnv`, `apiEnv`, `workerEnv` zod schemas. Each app parses on boot and crashes on a missing or invalid value. There are no `||` fallbacks between secrets (fixes VULN-001 class issues).
- Secrets stay managed with Envoy (`.envoy/` already in the repo). `.env.example` is generated from the zod schemas (`bun run env:example`) so it never drifts.
- New secrets: `LINK_ACCESS_SECRET` (replaces `AUTH_SECRET` for link-password cookies, 02 §M9), `CONFIRMATION_TOKEN_SECRET`, `REDIS_URL`, `R2_*`, `CF_API_TOKEN` + `CF_ZONE_ID` (custom hostnames), `POLAR_WEBHOOK_SECRET`, `API_KEY_PEPPER`.
- Removed: `AUTH_SECRET` (after M9 grace period), `EMAIL_TOKEN_SUFFIX`, all `STRIPE_*`, `*_PLAN_ID`, `LEVEL_*_UPGRADE_ID`, `SCHEDULER_*`, `PINATA_*`, `WEBMAIL_*`, `NEXT_PUBLIC_GOOGLE_FONTS_API_KEY` (font list becomes a static curated set, see 08).

## CI (GitHub Actions)

```
on: pull_request, push to master
jobs:
  checks:   bun install --frozen-lockfile → turbo lint typecheck test (affected)
  services: docker compose up mongo:8 redis:7 → integration tests (packages/db, core, redirect)
  migrations: restore anonymized fixture dump → run all pending migrations up → verify → down → up (idempotency)
  e2e:      build web+redirect+api → Playwright smoke (create link, redirect, password link, bio page, QR scan)
  legacy:   unchanged legacy build until P7
```

- CI env comes from the zod `.env.ci` file and no longer from a 20-line secret list with `'dependabot'` fallbacks.
- Required check for merge: checks + services + migrations.

## Coding conventions (written into `CLAUDE.md` for the repo)

- Server-only logic in `packages/core` never imports Next.
- No `"use server"` on model files (legacy did this on `User.ts` and `Session.ts`).
- Result types for expected failures (`{ ok: false, error: "slug_taken" }`); throw only for bugs.
- Every mutation that touches a link calls `linkCache.invalidate(domain, key)` through the service. There are no ad-hoc Redis calls.
- i18n keys only; no hardcoded user-facing strings.

## Deliverables / acceptance

- [ ] `legacy/` deploys on Forge exactly as before (smoke: redirect, login, dashboard).
- [ ] `bun install && bun run build` at the root builds all apps.
- [ ] `packages/db` connects, `db:indexes` dry-run prints the current vs desired diff against a prod snapshot.
- [ ] CI green with the new matrix; Dependabot PRs closed or merged per the policy above.
