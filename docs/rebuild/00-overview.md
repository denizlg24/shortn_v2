# Shortn Rebuild — Overview

Status: **draft for review** · Owner: Deniz · Last updated: 2026-10-09

This folder is the master plan for rebuilding Shortn. Each numbered file is a self-contained plan; each must be approved before implementation starts on it.

## Non-negotiables

1. **No data loss.** Every schema change ships as an _expand → migrate → verify → contract_ sequence. The contract (destructive) step only happens after the old app is retired **and** a verified backup exists. See [02](02-data-model-and-migrations.md).
2. **No broken short links.** Every `shortn.at/{code}`, `shortn.at/qr/{code}` and `shortn.at/b/{slug}` that resolves today must resolve after cutover, with the same destination and the same safety/password behavior. Printed QR codes are forever.
3. **Old app stays live until each surface is replaced.** We cut over surface by surface behind Cloudflare and nginx routing. There is no big-bang switch.
4. Hard project rules: bun only, strict typing (no `any`/`unknown` casts), self-documenting code.

## Decisions made (alignment round, 2026-10-09)

| Area           | Decision                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strategy       | Greenfield **bun + Turborepo monorepo** in this repo (new `apps/*`, `packages/*`). The legacy app moves to `legacy/` and keeps running until it's decommissioned.                                                                                    |
| Database       | **Stay on MongoDB Atlas.** Normalize the model, fix indexes, move clicks to a time-series collection with rollups.                                                                                                                                   |
| Redirects      | **Dedicated Bun + Hono redirect service on Forge** with local **Redis** (cache-aside for link resolution, Streams for click ingestion).                                                                                                              |
| Hosting        | Laravel Forge VPS behind **Cloudflare** (proxy, WAF, wildcard DNS, Cloudflare for SaaS for custom domains). The Vercel project is kept only as a path-preserving redirect, because some printed QR codes may encode `*.vercel.app` URLs (02 M0 #12). |
| Subdomains     | `app.shortn.at` (dashboard), `api.shortn.at` (REST + MCP), `{handle}.shortn.at` (bio pages), `shortn.at` (redirects + marketing).                                                                                                                    |
| Custom domains | User-owned domains for links and bio pages, sold as a **paid add-on**.                                                                                                                                                                               |
| Billing        | **Keep Polar**, rebuild the model: webhooks become the single source of truth, entitlements live locally, metering runs on Redis, and the external scheduler and Stripe leftovers are removed.                                                       |
| New features   | Workspaces/teams, public REST API + keys, link features (expiry, scheduling, targeting, rotation, OG override, deep links), bulk import/export + webhooks, **MCP server**, **llms.txt**.                                                             |
| UI             | shadcn/Tailwind v4 _primitives_ with an entirely new visual language, chosen through the impeccable direction round. No generic card/gradient SaaS look. See [12](12-design-system-and-ui.md).                                                       |
| Deliverable    | These markdown plans, plus a published HTML overview page.                                                                                                                                                                                           |

## Why rebuild (audit summary)

The issues below were found in the current code and drive the plans:

- **Redirect hot path** (`proxy.ts` → `app/api/get-long-url/[slug]/route.ts`): a Mongo `findOne` on every hit with no cache. `after()` then runs a _second_ `findOne`, a read-modify-write `doc.save()` on `clicks.total` (lost updates under concurrency), and a `Clicks.create`. QR hits add a third lookup. `urlCode` has **no unique index** (only a text index), and `nanoid(6)` is generated with no collision handling.
- **Reserved-word collisions:** custom codes can shadow app routes. `PUBLIC_PATHS` is enforced in the proxy, not at creation time.
- **Renaming a custom code** mutates `urlCode`. Analytics are keyed by `urlCode`, so history is orphaned or rewritten.
- **Subscriptions:** plan limits are duplicated with different values (`utils/plan-utils.ts` vs `lib/polar-usage.ts`). Usage is computed by querying Polar's events API on the request path. Downgrades depend on an external scheduler service plus a `ScheduledChange` collection. Monthly counters on `user` are never reset atomically. Stripe env vars and IDs are dead weight.
- **Data model:** tags and UTM campaigns are _copied_ into each link (`tags[]`, `utmLinks[].campaign`), and campaigns also hold `links[]`. Two sources of truth drift. Everything is owned by `sub`, so there's no concept of a team.
- **Live data-loss bug:** `deleteShortn` / `deleteQRCode` run `Clicks.deleteMany({urlCode})` before the ownership check and without a `sub` filter (`linkActions.ts:298`, `qrCodeActions.ts:354`). Any logged-in user can wipe another user's click history. This is fixed in P0 before anything else.
- **Secrets:** link-password JWTs and internal calls depend on the deprecated NextAuth `AUTH_SECRET` (see `SECURITY_AUDIT.md`).
- **Infra leftovers:** Vercel config, Sentry's Vercel cron monitors, Pinata/IPFS for user images, Meilisearch _and_ Atlas Search env vars, nodemailer _and_ Resend, ip2location, a rate-limit collection in Mongo.
- **Dependencies:** 6 open Dependabot PRs (eslint, react-email, parse5 8, react-day-picker 10, nanoid, npm_and_yarn group), zod 3, duplicated animation libs (`framer-motion` + `motion` + `gsap` + `ogl`), `canvas` native dep for QR, mismatched `react`/`react-dom` patch versions.
- **UI:** stock shadcn slate theme, card-heavy layouts, no consistent design language, no command palette or keyboard-first flow, bio pages limited to one layout.

## Target architecture

```
                      Cloudflare (DNS, proxy, WAF, SaaS custom hostnames)
                                         │
                                  Forge VPS · nginx
   ┌──────────────┬──────────────┬───────┴───────┬──────────────────┬─────────────────┐
shortn.at/{key}  app.shortn.at   *.shortn.at      api.shortn.at      shortn.at/(marketing)
custom domains   (dashboard)     (bio pages)      (REST v1 + MCP)
   │               │               │                 │                  │
apps/redirect    apps/web ───────── apps/web          apps/api           apps/web
(Bun+Hono)       (Next 16)        (bio route)       (Bun+Hono)          (marketing route group)
   │  ▲             │                                 │
   │  └── Redis (cache, counters, rate limits, Streams, BullMQ) ──┐
   │                                                              │
   └──── click stream ──► apps/worker (BullMQ + stream consumers) ┘
                                   │
                           MongoDB Atlas (source of truth)
                                   │
                         Polar · Resend · R2 · Web Risk
```

All write logic lives in `packages/core` (domain services). `apps/web` server actions, `apps/api` handlers and the MCP tools call the **same** services. Nothing talks to Mongo except through `packages/db` repositories.

## Plan index

| #   | Plan                                                       | Summary                                                                          |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 01  | [Monorepo & foundation](01-monorepo-foundation.md)         | Repo layout, tooling, deps, env, CI                                              |
| 02  | [Data model & migrations](02-data-model-and-migrations.md) | Target schemas, migration runner, every migration with verification and rollback |
| 03  | [Redirect service](03-redirect-service.md)                 | Bun/Hono resolver, Redis cache, safety, passwords, hostname routing              |
| 04  | [Analytics pipeline](04-analytics.md)                      | Click ingestion via Redis Streams, time-series storage, rollups, queries         |
| 05  | [Auth & workspaces](05-auth-and-workspaces.md)             | better-auth organizations, roles, `sub` → workspace migration                    |
| 06  | [Billing & entitlements](06-billing-and-entitlements.md)   | Polar as source of truth, entitlements, add-ons, metering                        |
| 07  | [Domains & subdomains](07-domains-and-subdomains.md)       | Host routing, handles, custom domains (Cloudflare for SaaS)                      |
| 08  | [Link-in-bio](08-link-in-bio.md)                           | Block-based bio pages on `{handle}.shortn.at`, migration from `BioPage`          |
| 09  | [Link features & QR](09-link-features-and-qr.md)           | Expiry, scheduling, targeting, rotation, OG, deep links, QR rebuild              |
| 10  | [API, MCP & llms.txt](10-api-mcp-llms.md)                  | REST v1, API keys, OpenAPI, webhooks, MCP server, llms.txt                       |
| 11  | [Bulk import/export](11-bulk-import-export.md)             | CSV import, exports, outgoing webhooks                                           |
| 12  | [Design system & UI](12-design-system-and-ui.md)           | Visual world, tokens, app shell, surface-by-surface IA                           |
| 13  | [Infra, ops & security](13-infra-ops-security.md)          | Forge layout, Redis, backups, observability, security fixes                      |
| 14  | [Cutover & rollout](14-cutover-and-rollout.md)             | Phase order, traffic switching, verification gates, rollback                     |

## Phase order (detail in 14)

| Phase                                  | Goal                                                                                                                                                                                             | Unblocks                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **P0 Safety net**                      | **Hotfix the legacy cross-user click deletion bug**, PITR backups verified, prod data audit (duplicates, orphans, reserved collisions, QR origins, Polar products), snapshot restored to staging | everything                                                |
| **P1 Foundation**                      | Monorepo, `packages/db` + migration runner, CI, staging on Forge                                                                                                                                 | P2+                                                       |
| **P2 Redirects + clicks**              | `apps/redirect` + Redis + worker take over `shortn.at/{key}`; dual-write old `clicks` + new `click_events`                                                                                       | biggest perf/correctness win, old dashboard keeps working |
| **P3 Data expansion**                  | Workspaces, `links` key/domain fields, normalized tags/campaigns, clicks backfill — all additive                                                                                                 | new dashboard                                             |
| **P4 New dashboard + billing**         | `app.shortn.at` at feature parity, new billing model, users migrated                                                                                                                             | legacy dashboard retirement                               |
| **P5 Bio subdomains + custom domains** | `{handle}.shortn.at`, custom domain add-on                                                                                                                                                       |                                                           |
| **P6 Platform**                        | REST API, MCP, llms.txt, bulk, link features                                                                                                                                                     |                                                           |
| **P7 Contract**                        | Retire legacy app, drop legacy fields/collections after archive                                                                                                                                  | done                                                      |

## Open decisions (need an answer before the relevant plan is implemented)

1. **Pricing & limits** of the new plans and add-ons ([06](06-billing-and-entitlements.md)). The plans assume current limits are grandfathered.
2. **Mongo driver:** native `mongodb` driver + zod-typed repositories (recommended), or keep Mongoose ([01](01-monorepo-foundation.md)).
3. **Search:** Atlas Search (recommended, since we're already on Atlas) or keep Meilisearch ([04](04-analytics.md) §search).
4. **QR scan attribution** for newly printed QR codes: a reserved `?qr` marker vs. a dedicated QR key ([09](09-link-features-and-qr.md)).
5. **Atlas tier:** confirm continuous backup/PITR is enabled. If the cluster is shared tier, P0 must add scheduled `mongodump` to R2 ([13](13-infra-ops-security.md)).
6. ~~Visual direction~~. **Resolved 2026-10-09:** the category standard at full craft, with Linear + Dub.co as the bar. Direction contract in [12](12-design-system-and-ui.md).
7. **Raw-IP retention** for the legacy `clicks` archive ([02](02-data-model-and-migrations.md) §C4).
8. **Polar period-end downgrades:** verify whether Polar can schedule a product change for period end. If it can't, use our own BullMQ delayed job ([06](06-billing-and-entitlements.md)).
9. **Monthly creation limits vs. active-link limits**, and dropping the redirect meter ([06](06-billing-and-entitlements.md)).

## Review log

- 2026-10-09: adversarial review of 00/02/03/04/06/07/14 against the legacy code. 15 findings, all folded in. Main results: coexistence rules (02 §3a), per-phase routing table (14), a stream trimming fix (04), the password migration order (02 M9), Polar migration sequencing (06), and the P0 hotfix.
