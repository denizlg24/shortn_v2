# 16 — P4 task breakdown

P4 (14) delivers `app.shortn.at` at parity with the legacy dashboard, the new billing model and the session handoff. This file splits it into slices that each land as one PR into `staging`. Production switches (beta banner, billing switch, default switch) are operator steps at the end, because each one is outward-facing.

## Decisions taken at breakdown (2026-10-10)

| #   | Decision                                                                                                                                                                                                                                                                          | Why                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Workspaces, members and invitations are implemented in `packages/core` on the M2 collections (`workspaces`, `workspace_members`), **not** with better-auth's organization plugin. Invitations get their own `workspace_invites` collection.                                       | M2 already created both collections with ObjectId references and legacy-derived slugs. The organization plugin would need a parallel `organization`/`member` set or a brittle field mapping over the adapter's id handling. |
| D2  | `packages/auth` reuses legacy's `user`, `session`, `account` and `verification` collections, field names and `shortn_auth_` cookie prefix. Sessions stay in Mongo (`storeSessionInDatabase`) with Redis as `secondaryStorage`.                                                    | Existing credentials and OAuth accounts must work unchanged. Legacy reads the same session documents for its login-activity screen.                                                                                         |
| D3  | Two-factor, passkeys and SSO (05 "Added") are **not** part of P4. They follow in P6 behind workspace flags.                                                                                                                                                                       | None of them is in the parity checklist, and each adds a login path that has to be tested against legacy-shared sessions.                                                                                                   |
| D4  | Billing jobs use a Redis stream (`billing:events`) consumed by apps/worker, instead of adding BullMQ.                                                                                                                                                                             | The worker already runs stream consumers with claim and retry (04). One queue mechanism is less to operate.                                                                                                                 |
| D5  | New writes keep legacy fields current during coexistence: `sub`, `urlCode`, `longUrl`, `tags` (embedded), `passwordProtected`/`passwordHash`/`passwordHint`, `date`, plus the new fields (`workspaceId`, `domain`, `key`, `destination`, `tagIds`). `_sync.lastWriter` is `"v2"`. | 02 §3a.1: legacy fields stay authoritative for the redirect until contract, and the legacy dashboard reads the same documents.                                                                                              |
| D6  | Staging hosts follow 15's container table: `app-staging.shortn.at` (web), `api-staging.shortn.at` (api).                                                                                                                                                                          | Single-level hosts work with the existing Universal SSL certificate.                                                                                                                                                        |
| D8  | Until the billing switch, the new Billing page shows plan, usage and invoices, and offers checkout to free workspaces; plan changes and cancellation link to legacy's billing page. `BILLING_WRITES=1` turns them on at the switch.                                               | Legacy's Polar hooks stay live on the same subscriptions until the switch, and its cancel hook schedules its own downgrade job; changes from both sides would race.                                                         |
| D7  | New marketing is out of P4's critical path. The P4 routing column ships `/authenticate`, safety and report pages on web; `/` and marketing stay on legacy until the marketing surface has its own impeccable round. 14's "same time or shortly after" allows this.                | The marketing round is a separate Persuade-mode design pass (12).                                                                                                                                                           |

## Slices

### Staging integration checkpoint — 2026-10-11

Owner acceptance update: visual/product review is approved, with refinements deferred. The owner explicitly waived the seven-day observation requirement and requested immediate execution of all remaining checks. This removes the duration gate; staging/provider results must still be recorded accurately.

P4 is integrated into `staging`. The owner approved visual/product review, deferred refinements, waived the seven-day observation duration, and explicitly deferred OAuth credentials/callback checks to production setup. Staging now passes the 47-route page map in en/pt/es, credential login, external reset-email delivery, real S3 uploads, cross-host legacy handoff and replay rejection, legacy bio rendering, and public password/safety flows through the Worker. Polar sandbox checkout/payment, current-format webhook delivery, immediate upgrade, scheduled downgrade through a real shortened renewal, cancel/resume, payment history, invoice download and portal access passed. Invoice preparation and download from the UI also passed after fixing the discovered gap. See `audit/2026-10-11-p4-ux.md` for evidence and the pre-existing sandbox reconciliation exceptions. Production routing and billing switches remain separate operator actions.

| Slice | Content                                                                                                                                                                                                                                                          | Exit                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4.1   | `packages/auth`, `apps/web` scaffold (Next 16, standalone, Dockerfile), env schema, login/register/verify/reset/recover, workspace-gated shell, `/{ws}` routing, `packages/core` workspace context + `can()`                                                     | Existing staging user logs in on `app-staging.shortn.at` with password and OAuth, lands in their workspace |
| 4.2   | `packages/core` services: links, tags, campaigns, QR, with legacy-compatible writes, cache invalidation and usage reservation; `packages/billing` catalog + entitlements                                                                                         | Service tests: create/update/delete round-trip readable by legacy shape and by the redirect projection     |
| 4.3   | Links desk (table, composer, sheet, edit, delete, bulk), link analytics page, workspace analytics                                                                                                                                                                | Create → copy in two interactions; analytics numbers equal rollups                                         |
| 4.4   | QR codes (list, editor, download), campaigns (list, detail, UTM builder, CSV export), tags                                                                                                                                                                       | Parity rows for QR and campaigns checked                                                                   |
| 4.5   | Bio pages editor on the v2 block model (public rendering stays legacy `/b/` until P5)                                                                                                                                                                            | Edits on v2 render in legacy `/b/{slug}` (M8 keeps both shapes)                                            |
| 4.6   | Settings: general, members + invites, account (profile, email, password, OAuth linking, sessions, delete), billing (plan, usage, checkout, portal, change plan, cancel)                                                                                          | Polar sandbox: subscribe → upgrade → scheduled downgrade → cancel                                          |
| 4.7   | `apps/api` with the Polar webhook handler in shadow mode, worker `billing.apply` consumer, nightly reconciler, `packages/emails`                                                                                                                                 | Replay 10× = same state; shadow diff report empty on staging                                               |
| 4.8   | Session handoff (legacy mints, web exchanges), "Try the new Shortn" banner in legacy, `/authenticate` + link-password verification on web (bcrypt + `LINK_ACCESS_SECRET`), safety interstitial and report pages, edge Worker P4 routing column behind a variable | Logged-in legacy user reaches the new dashboard without re-login; password link round-trip on staging      |
| 4.8b  | **UI rewrite to the owner's IA rules (12, superseded IA note)**: full pages instead of sheets, separate create/manage pages, explicit filters, across links, analytics, QR, campaigns, bio, settings                                                             | Owner review passes on local dev before staging                                                            |
| 4.9   | Playwright e2e suite, parity checklist filled in, staging sign-off, promotion PR                                                                                                                                                                                 | 14 P4 exit gate on staging                                                                                 |

## Operator steps after the slices (need explicit go-ahead)

1. Promote `staging → master`. The new app ships dark on `app.shortn.at`.
2. Beta: enable the legacy banner in production (internal first, then Vida Económica with consent, then everyone).
3. Verify webhook shadow processing and reconciliation, then the billing switch (06 §Migration step 5). The owner waived the fixed seven-day P4 duration.
4. Default switch: deploy the edge Worker with the P4 routing column; email + changelog the week before (14 §Communication).

## Parity checklist (14 §Parity checklist, completed here)

Status: ✅ built and tested (automated suite plus relevant staging boundaries) · ⏳ pending · ↪ deferred or retained in legacy (with reason).

Updated 2026-10-11 from the automated and real-provider evidence in `audit/2026-10-11-p4-ux.md`. OAuth setup is explicitly deferred to production by the owner. Billing shadow processing remains enabled; production side effects and routing switches are separate operator actions.

Approximate EUR plan pricing from 06 is implemented locally with daily cached ECB rates, a dated source note and explicit USD billing amounts. Refresh failures retain the last-known rate; cold failures show USD only. Staging displayed the live ECB rate and the real sandbox charges.

| Legacy feature                                                                 | New home                                                                       | Status |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------ |
| Links CRUD, custom codes (Basic+), tags                                        | `/{ws}/links` list, create/edit/confirmation pages · `core/links`, `core/tags` | ✅     |
| UTM variants, campaigns, UTM defaults                                          | `/{ws}/links/{id}/utm` pages, `/{ws}/campaigns` · `core/campaigns`             | ✅     |
| Password links + hint (Pro)                                                    | link create/edit pages · `/authenticate/{key}` on web · `core/links/public`    | ✅     |
| Safety interstitial, blocked page, report                                      | `/safety/{key}` on web · `core/links/public`                                   | ✅     |
| QR create/edit/customize/download                                              | `/{ws}/qr` · `core/qr` (legacy option format kept)                             | ✅     |
| QR analytics                                                                   | analytics scope `qr`                                                           | ✅     |
| Link analytics: time series, geo, devices, browsers, OS, referrers, UTM tables | `/{ws}/links/{id}`, `/{ws}/analytics` · `core/analytics/queries`               | ✅     |
| Analytics CSV export                                                           | export route on analytics (csvExport feature)                                  | ✅     |
| Bio pages: create, customize, links, socials, header, fonts                    | `/{ws}/bio` editor writing legacy fields; public render stays legacy `/b/`     | ✅     |
| Subscription: checkout, portal, success page                                   | `/{ws}/settings/billing` · `billing/polar`                                     | ✅     |
| Upgrade, downgrade, cancel                                                     | billing page, behind `BILLING_WRITES` (D8)                                     | ✅     |
| Subscription emails                                                            | worker `billingMailer` in live mode                                            | ✅     |
| Account: profile, email change, password, sessions                             | `/{ws}/settings/account` via better-auth client                                | ✅     |
| OAuth login/linking                                                            | Owner deferred real credentials/callback checks to production setup            | ↪      |
| Account deletion                                                               | not in legacy (14's checklist listed it); 05's soft-delete flow follows P4     | ↪      |
| Sign up, sign in (email or username), verify, recover, reset                   | `(auth)` routes                                                                | ✅     |
| Admin impersonation                                                            | handoff carries `impersonatedBy`; banner in shell                              | ✅     |
| Contact form                                                                   | ↪ legacy marketing until the marketing round (D7)                              | ↪      |
| i18n en/pt/es                                                                  | next-intl catalogs per namespace                                               | ✅     |
| Legal pages                                                                    | ↪ legacy marketing (D7); app links to them                                     | ↪      |
| `/qr/{code}` legacy URLs                                                       | apps/redirect (P2)                                                             | ✅     |
| `/b/{slug}` legacy URLs                                                        | ↪ legacy until P5                                                              | ↪      |

## Public bio design scope (clarified 2026-10-11)

P4 replaces the dashboard bio editor and preserves legacy-compatible content. It does **not** replace the visitor-facing `/b/{slug}` renderer. P5 owns the public renderer and visual redesign described in 08, together with subdomains and custom domains. The old public layout is not the design target for the new renderer.

P5's design acceptance must cover empty, short and long link lists, long titles, links with and without images, and desktop/mobile layouts. Validate representative pages with 20+ links as well as the small demos; a preset that only works with a few links is incomplete. The editor preview must use the same public renderer when it lands.

## Deployment wiring (staging first, then production)

New Forge targets, one project each (Forge convention): `shortn-web[-staging]` (rootDirectory `apps/web`, health `/api/health`, hosts `app.shortn.at` / `app-staging.shortn.at`) and `shortn-api[-staging]` (rootDirectory `apps/api`, health `/__health`, hosts `api.shortn.at` / `api-staging.shortn.at`).

Secrets that must match across services:

| Variable                                                        | Set on                        | Why                                                                |
| --------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `LINK_ACCESS_SECRET`                                            | web, redirect                 | web signs the `link_access_{key}` cookie, the redirect verifies it |
| `CONFIRMATION_TOKEN_SECRET`                                     | web, redirect                 | safety-page tokens                                                 |
| `INTERNAL_API_SECRET` (legacy) = `LEGACY_INTERNAL_SECRET` (web) | legacy, web                   | `/api/internal/revalidate-bio`                                     |
| `POLAR_WEBHOOK_SECRET`                                          | api                           | the second Polar endpoint's own secret (shadow), not legacy's      |
| Mongo + both Redis URLs                                         | web, api (Mongo only), worker | same database and caches as the redirect                           |

Order: set `LINK_ACCESS_SECRET` and `CONFIRMATION_TOKEN_SECRET` on the redirect **before** the edge Worker routes `/authenticate` and `/safety` to web, otherwise visitors get a cookie the redirect can't read. Legacy needs `NEW_APP_URL` (and `NEW_DASHBOARD_BETA` for the banner) for the handoff. Web is built with `WEB_ASSET_ORIGIN` = its own origin so pages proxied on shortn.at load their assets. Worker gets `POLAR_ACCESS_TOKEN` to process billing events (shadow by default).

Before the first web deploy: `bun run db:indexes` against the environment's database (new indexes: `m.workspaceId` time index on click_events, members by user, invites, billing events TTL, handoff token TTL, subscriptions by workspace).
