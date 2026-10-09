# 14 — Cutover & Rollout

Each phase has **entry criteria**, **work**, an **exit gate**, and a **rollback**. Gates are sized to the real traffic (~60 redirects/day, measured 2026-10-09): a deterministic check over all the data beats a long soak that sees a few hundred requests.

## P0 · Safety net (≈ 1 week)

- Work:
  - **Ship the legacy click-deletion hotfix first** (02 §4: unscoped `Clicks.deleteMany` before the ownership check). It's a live data-loss and IDOR bug.
  - Set up PBM full + PITR backups to R2 and the offsite weekly dump; do a point-in-time restore to staging; size the oplog; lock port 27018 to Forge IPs with TLS; run the `db:audit` (02 §4), and resolve blocking audit items.
  - Enable `changeStreamPreAndPostImages` on link and QR collections.
  - Mine 30 days of Cloudflare logs (and Forge's per-deployment request logs) for every `/api/*` caller and every Host header seen. External callers (`/api/track-click`, the scheduler's `/api/polar/execute-downgrade`, `/api/cron/moderate`) need an owner in the routing table below.
  - Merge security Dependabot PRs into legacy and freeze legacy for features.
- Exit gate: hotfix deployed, a restore drill documented, the audit report reviewed, and every blocking item with a recorded resolution.
- Rollback: n/a (read-only).

## P1 · Foundation (≈ 1–2 weeks)

- Work: plan 01 (monorepo, `legacy/` move, packages, CI, staging target, Forge-host Redis instances (13)). There is no routing layer to set up: with Caddy matching on hostname, everything on `shortn.at` already goes to legacy.
- Exit gate: legacy deploys from `legacy/` unchanged, staging is up, and the migration runner is tested on the fixture.
- **Done 2026-10-09:** promoted in #421 (prod target now `legacy/` + Dockerfile, previews off), Redis instances running and wired into both targets.
- Rollback: revert the `git mv` PR.

## P2 · Redirects + click pipeline (≈ 1–2 weeks)

- Work: apps/redirect, apps/worker (ingest + dual-write legacy `clicks`), the edge Worker (13 §Edge routing), M1 (dedupe) + M3/M4 (key/domain, QR ref) expand migrations, the legacy cache-invalidation patch + change stream, M7 backfill.
- **Entry:** P1 done. Building starts immediately; the only hard floor is that PBM backups pass a restore test before M1 or any other migration writes to prod (02 §7).
- **Parity check (replaces shadow mode):** on staging, against the restored prod snapshot, a script resolves **every** link and QR key through apps/redirect and through the legacy resolution logic, and compares status + `Location`. Mismatches are fixed or documented as intentional. This covers every key in minutes instead of waiting a week for ~400 real requests.
- **Cutover:** deploy the Worker with single-segment paths and `/qr/{key}` routed to apps/redirect at 100%. `CANARY_PERCENT` stays as the kill switch, not a ramp; at this volume a 5% slice carries no signal.
- Exit gate: 48 h at 100% with no alert, and the dual-write counts match for that window (`click_events` vs legacy `clicks` with `src:"v2"`, per link).
- Rollback: set `CANARY_PERCENT=0` (one Worker config deploy, seconds). The Worker's retry-to-legacy on 5xx is the automatic version of the same thing. The worker's dual-write means legacy analytics never had a gap.

## P3 · Data expansion (≈ 2 weeks, runs in parallel with P2)

- Work: M2 (workspaces), M5 (tags), M6 (campaigns/UTM), M8 (bio v2), M9, M10, M11 (shadow only), M12 (assets). All of these are additive and continuous while legacy runs.
- **Entry:** P1 done; starts alongside P2. Same backup floor as P2 before the first prod run.
- Exit gate: every migration's `verify` is green on staging (prod snapshot) and then on prod after two consecutive continuous runs.
- Rollback: each migration's `down` (additive fields only, so legacy is unaffected either way).

## P4 · New dashboard + billing (≈ 5–7 weeks)

- Work: apps/web dashboard at parity (links, analytics, QR, bio editor, campaigns, settings, members, billing), apps/api webhooks for Polar in shadow, session handoff (05), and email templates.
- **Beta:** an opt-in "Try the new Shortn" banner in legacy, with feedback collected in-app. Internal + Vida Económica first (with their consent), then all users opt-in. Both UIs operate on the **same data**. That's safe because new code writes legacy-compatible fields until contract (the new services also set `sub`, `urlCode`, `longUrl`, … on create/update during coexistence).
- **Billing switch:** move the Polar webhook URL to the new handler after 7 days of zero-diff shadow processing (06), then retire the scheduler.
- **Default switch:** `shortn.at/{locale}/dashboard*` → 302 to `app.shortn.at` with handoff. Legacy marketing is replaced by the new marketing on root at the same time or shortly after.
- Exit gate: parity checklist (every legacy feature mapped and checked), e2e suite green, no P1 bugs open for 7 days, billing reconciler at zero drift.
- Rollback: remove the 302 (legacy dashboard is still deployed and still reads the same data). For billing, point the webhook back at legacy, since the mirror rebuilds from Polar.

## P5 · Bio subdomains + custom domains (≈ 2–3 weeks)

- Work: `{handle}.shortn.at` routing, `/b/` 301s, owner notification emails, the custom domain add-on in Polar, Cloudflare for SaaS, and the domain UI.
- Exit gate: 100% of bio slugs resolve via the 301 in the URL sample; one real custom domain in production for ≥ 7 days.
- Rollback: `/b/{slug}` served by the new web app directly (no 301) while the subdomain issue is fixed.

## P6 · Platform (≈ 3–4 weeks, parallelizable)

- REST v1, API keys, outgoing webhooks, MCP, llms.txt, bulk import/export, and link rules (09) behind feature flags per workspace.
- Exit gate per feature: contract tests + docs + a staged rollout to 10% → 100% of workspaces.

## P7 · Contract (≈ 1 week, after ≥ 14 days with legacy off)

- Preconditions: legacy processes stopped (not deleted) for 14 days, a restore drill passed this month, a full dump of the affected collections in R2 with checksums, and the raw-IP retention decision signed off.
- Work: contract steps C1–C6 (02 §6), delete `legacy/`, remove legacy env vars, unpin Pinata assets (+30 days), close out the scheduler service.
- Rollback: restore archived fields from `archive_*` collections or the dump (scripted and rehearsed in staging before running on prod).

## Routing table per phase (Worker origin that owns each path on `shortn.at`)

| Path                                                            | P1                  | P2–P3               | P4                                                                  | P5+                       | P7             |
| --------------------------------------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------- | ------------------------- | -------------- |
| `/{key}`, `/qr/{key}` (+ trailing `/`)                          | legacy              | **redirect** (100%) | redirect                                                            | redirect                  | redirect       |
| `/b/{slug}`                                                     | legacy              | legacy              | legacy                                                              | **redirect → 301 handle** | redirect       |
| `/`, marketing pages, `/{locale}/*` marketing                   | legacy              | legacy              | **web**                                                             | web                       | web            |
| `/{locale}/dashboard*`                                          | legacy              | legacy              | 302 → `app.` handoff                                                | same                      | same           |
| `/authenticate/*`, `/api/verify-link-password`                  | legacy              | legacy              | **web** (bcrypt + new secret, 02 M9)                                | web                       | web            |
| `/{locale}/safety/*`, `/abuse`, report endpoints                | legacy              | legacy              | web                                                                 | web                       | web            |
| `/api/auth/*` (better-auth, legacy Polar webhook)               | legacy              | legacy              | legacy until billing switch + session handoff complete, then `app.` | —                         | removed        |
| `/api/polar/*`, `/api/cron/*` (scheduler callbacks)             | legacy              | legacy              | legacy until scheduler frozen (06)                                  | —                         | removed        |
| `/api/track-click` and other external `/api/*` found in P0 logs | legacy              | legacy              | owner decided in P0                                                 | —                         | removed or 410 |
| Hosts `www.`, legacy `*.vercel.app`, other origins in QR data   | 301 path-preserving | same                | same                                                                | same                      | same, forever  |

Each column change is one Worker config deploy, reverted in seconds. Host-level rows (`app.`, `api.`, bio handles) are Forge target domains; the Worker only decides paths on `shortn.at` and custom hostnames.

## Parity checklist (seed, to be completed in P4)

Links CRUD · custom codes · tags · UTM variants · campaigns + UTM defaults · password links + hint · safety interstitial + report · QR create/edit/customize/download · QR analytics · link analytics (time series, geo, devices, browsers, OS, referrers, UTM tables, CSV export) · bio pages (create/customize/links/socials/header/fonts) · subscription (checkout, portal, upgrade, downgrade, cancel, success page, emails) · account (profile, email change, password, OAuth linking, sessions/login activity, delete) · admin impersonation · contact form · i18n en/pt/es · legal pages · `/qr/{code}` legacy URLs · `/b/{slug}` legacy URLs.

## Communication

- In-app changelog + email before P4 default switch ("new dashboard, same links") and before P5 ("your bio page now lives at handle.shortn.at; old links keep working").
- No user action is required for any migration step except optional bio handle changes.

## Rough total

≈ 4–5 months for one developer working with agents, with P6 items parallelizable. The estimate is deliberately coarse; each plan gets a task breakdown when it's picked up.
