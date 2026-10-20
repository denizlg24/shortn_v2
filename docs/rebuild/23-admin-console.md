# 23 — Platform admin console (`apps/admin`)

Status: design, 2026-10-19; owner questions resolved (§6). Phase A in progress on `feat/admin-enforcement`. It replaces the separate repo `shortn-admin-console` (legacy schema: `UrlV3`/`Clicks`/plan on `User`, Polar called directly, no workspaces) with an ops console in the monorepo. It reuses `@shortn/db`, `@shortn/core`, `@shortn/ui`, `@shortn/auth`, `@shortn/billing`, `@shortn/redis` and `@shortn/emails`.

Owner decisions already made: monorepo app; full write actions now; a dense ops UI (faceted tables, server-side pagination, real time series, in-page flows, no sheets); must scale (no whole-collection loads; rollups and indexes only).

Line references point to `master` at `bcd238c` unless they name the old repo (`shortn-admin-console@f930094`, written `old:`).

---

## 0. Findings that shape the design

These are facts about current code. Several are gaps that must be closed **before** any admin button can mean anything.

| # | Finding | Evidence | Consequence |
| --- | --- | --- | --- |
| F1 | **Bans are not enforced anywhere.** Neither the rebuild nor legacy checks `user.banned` when it creates a session. The old console's ban only deleted sessions, so a banned user could sign in again straight away. | `packages/auth/index.ts:349-381` (session create hook: passkey + geo only); no `banned` reference in `packages/auth`, `apps/web`, `apps/api` or `legacy/lib`. The only reader is `apps/worker/src/workspace-export-notice.ts:76-81`. `old:app/api/admin/users/[id]/ban/route.ts:44-69` | Ban enforcement (§3.1) has to land first. |
| F2 | `role`, `banned`, `banReason`, `banExpires` aren't declared in the rebuild's better-auth user schema. | `packages/auth/index.ts:202-226` vs `old:lib/auth.ts:51-58` | The main app can't read them from `session.user`. Declare them with `input: false` so update-user can never mass-assign them. |
| F3 | Rebuild impersonation already exists, but it runs through **`handoff_tokens`**, not HMAC. The rebuild serves no `/api/auth/impersonate-handoff`; only legacy does. The handoff creates a session stamped `impersonatedBy` with a one-hour cap, skips 2FA, and the shell shows a banner. | `packages/auth/handoff.ts:27-101` (2FA skip at `:55`, session at `:84-94`); `packages/auth/index.ts:328-347` (1 h cap); `apps/web/src/app/[workspace]/layout.tsx:83`; `legacy/lib/impersonation-handoff.ts:111-200`; `legacy/app/api/handoff/route.ts:31-58` | The admin app writes a `handoff_tokens` row directly (shared DB) and needs no `INTERNAL_API_SECRET`. |
| F4 | The old console's impersonation is **already broken**: its tokens have no `jti`, and legacy rejects any token without one or without a pre-created `ImpersonationNonce`. | `old:lib/impersonation.ts:22-33`; `legacy/lib/impersonation-handoff.ts:45-62` | Parity isn't a constraint. Drop the HMAC design. |
| F5 | Impersonated sessions are blocked only from 2FA, passkey and SSO management. They can still change password or email, delete workspaces, manage billing, create API keys and consent to MCP OAuth. | `packages/auth/two-factor.ts:72-77`, `packages/auth/passkeys.ts:127`, `packages/auth/enterprise-sso.ts:306,398,595`; nothing in `apps/web/src/server/context.ts:10-19` | Harden impersonation (§3.6) before the admin app exposes it. |
| F6 | In the rebuild, `disabled` is **moderation-only**. Owners have no path to clear it. A `blocked` safety status survives destination edits, and rescans never re-enable a link. | `packages/core/links/service.ts:1026-1045` (sticky `blocked`), `:1619-1620`; auto-block at `packages/core/links/public.ts:228-243`; no `disabled` input in `apps/api/src/rest.ts` | A takedown can reuse `disabled`/`safetyStatus` for redirect and legacy compatibility. It still needs its own `moderation` record so restore and attribution are exact. |
| F7 | The change-stream cache invalidator only invalidates **root-domain** keys: it calls `invalidateLinks(cache, env.LINK_DOMAIN, keys)`. Custom-domain links depend on writers calling `invalidateLinks` with `link.domain` explicitly. | `apps/worker/src/invalidator.ts:29-37,120-124`; `apps/worker/src/index.ts:67-73`; explicit callers listed by `graft callers invalidateLinks` (e.g. `packages/core/links/public.ts:276`) | Every admin link write must call `invalidateLinks(cache, link.domain ?? LINK_DOMAIN, keys)` itself. Otherwise a custom-domain link stays cached for up to about an hour (`cached-link.ts:35-38`), plus 10 s in L1 (`apps/redirect/src/resolver.ts:27-32`). |
| F8 | The edge **falls back to legacy** when the redirect origin returns ≥500 or times out. Rollback (`CANARY_PERCENT=0`) sends every redirect to legacy. Legacy blocks only on `disabled`/`safetyStatus`. | `apps/edge/src/index.ts:300-323`; `legacy/app/api/get-long-url/[slug]/route.ts:25-32` | Takedowns must also set legacy-honoured fields. Workspace suspension needs a small legacy patch until P7. |
| F9 | Billing has **no entitlement override hook**. The only per-workspace override is `workspaces.platformFeatures`, which holds rollout flags for api/mcp/webhooks/bulk/linkRules/advancedAuth. It doesn't touch plan limits. | `packages/billing/entitlements.ts:60-87`; `packages/core/platform/features.ts:10-26`; schema `packages/db/schemas/index.ts:252-261` | Overrides and comps need new plumbing (§3.4). Other code also reads subscriptions without going through `loadEntitlements`: `packages/billing/polar.ts:203-211`, `packages/auth/sso-authority.ts:216-230`, `packages/core/workspaces/members.ts:432-435`. |
| F10 | The REST/MCP rate limit uses a hard-coded per-plan table that disagrees with the catalog: plus 180 vs 300/min, pro 600 vs 1200/min. | `apps/api/src/rest.ts:573-579`, `apps/api/src/mcp.ts:116-122` vs `packages/billing/catalog.ts:79,100` | Fix it while adding overrides: read `entitlements.limits.apiPerMinute`. The owner should confirm which numbers are correct (Q6). |
| F11 | The rebuild's `audit_log` is shaped for **MCP tool calls**: `workspaceId`, `credentialId` and `tool` are required, and its only index is workspace-scoped. | `packages/db/schemas/index.ts:558-568`; `packages/core/mcp/audit.ts:6-43`; `packages/db/indexes.ts:195-197` | Keep platform-staff actions in `admin_audit_log` (§1.7). |
| F12 | **Account deletion doesn't exist** in the rebuild. Plan 05 specifies it, but only "delete an empty team workspace" is implemented. | `docs/rebuild/05-auth-and-workspaces.md:49-52`; `packages/core/workspaces/members.ts:416-443` | GDPR deletion (§3.13) is new work, not reuse. Two pieces can be reused: workspace export and link trash purge. |
| F13 | Indexes are missing on the hot admin paths: `session.userId`, `account.userId`, `link_reports.{linkId,reporterIpHash}`, `click_rollups.day`, `click_rejects.at`, `user.createdAt`/role/banned, and `admin_audit_log` compounds. | `packages/db/indexes.ts` (none for these); legacy mongoose declares only `session.token` and `user.email`/`sub` uniques (`legacy/models/auth/Session.ts:65`, `User.ts:22,28`). `reportLink` queries `{linkId, reporterIpHash}` unindexed (`packages/core/links/public.ts:189-191`) | §2.12 index plan. |
| F14 | `contacts` has no status field. The mongoose index on `{email, status}` references a field that is never written. | `legacy/models/Contact.ts:32-84`; rebuild writer `apps/web/src/app/%5Fmarketing/[locale]/contact/send/route.ts:67-82` | Triage needs a new subdocument. |
| F15 | TOTP secrets are encrypted with the **app's** auth secret. Passkeys are bound to `rpID = app hostname`. | better-auth two-factor encrypts with `ctx.context.secret`; `packages/auth/two-factor.ts:139-142` decrypts with `secretConfig`; `packages/auth/passkeys.ts:42-46` | A separate admin better-auth instance couldn't reuse either factor without sharing the app secret, which drives the §1 decision. |
| F16 | 2FA enrollment is gated on membership of a workspace with `platformFeatures.advancedAuth`. | `packages/auth/two-factor.ts:12-34,90-98` | Platform admins can't necessarily enrol. Allow it for admin roles. |
| F17 | `GET /__metrics` on the redirect service is registered **before** the edge-auth middleware, so it's unauthenticated. | `apps/redirect/src/app.ts:135-144` | The admin must not depend on scraping it publicly. Gate it separately. Outside this plan, but flagged. |
| F18 | `session.userId` is stored as a string in some rows and an ObjectId in others. Existing code already queries `{userId: {$in: [id, ObjectId(id)]}}`. | `packages/auth/two-factor.ts:135-137` | Every admin query by `userId` on better-auth collections (`session`, `account`, `twoFactor`, `passkey`) must match both types. |

---

## 1. Admin authentication and authorization

### 1.1 Decision: elevation from app.shortn.at plus an admin-local session store

The admin app **has no sign-in UI and no better-auth instance**. The user proves identity on `app.shortn.at` with any method plus a TOTP step-up. A one-time elevation token is then exchanged for an admin session stored in `admin_sessions`, with its own host-only cookie.

Options considered:

| Option | For | Against |
| --- | --- | --- |
| A. Separate better-auth instance (old console: `shortn_admin_` prefix, shared `user` collection, `old:lib/auth.ts:13-73`) | Independent of apps/web; known shape | Password-only unless MFA is rebuilt. The TOTP rows can't be decrypted without the app secret (F15). Admin-side enrollment would write `user.twoFactorEnabled` on the shared user doc and break the main app's 2FA state. Passkeys can't be reused (rpID). Sessions land in the shared `session` collection, so they show in the user's session list and are killed by "revoke all". Two sign-in surfaces to harden. |
| B. Reuse `createAuth` on the admin host | One code path | `createAuth` hard-codes the cookie prefix (`packages/auth/index.ts:146`), sign-up, social providers, the Polar customer-on-signup plugin (`:106-110`) and the personal-workspace hook (`:242-252`). The admin host would become a second full sign-in surface, and parametrizing all of that is invasive. Admin sessions would be ordinary app sessions with the same blast radius. Passkeys are still bound to the app rpID. |
| **C. Elevation (chosen)** | Reuses the main app's hardened sign-in: rate limits, the legacy password gate, 2FA replay protection (`two-factor.ts:141-165`), passkeys and SSO. One MFA enrollment per human. The admin session lives in its own collection, so it never mixes with user sessions. It follows the existing handoff pattern (`packages/auth/handoff.ts`). | Signing in to the admin needs apps/web up (existing admin sessions keep working). A small new better-auth plugin is needed. Admins must have TOTP enrolled in the main app (fix F16). |

**Flow:**

1. `GET admin.shortn.at/login`: the admin server generates a 32-byte `nonce` and sets `__Host-shortn_admin_nonce` (HttpOnly, Secure, SameSite=Strict, 5 min). It then redirects to `https://app.shortn.at/admin/elevate?n=<sha256(nonce)>&purpose=login`. App and admin share the registrable domain `shortn.at`, so a Strict cookie survives the round trip.
2. `app.shortn.at/admin/elevate` is a new apps/web page. It needs a session (otherwise `/login?next=…`). It refuses when the session is impersonated, or when the user isn't `role ∈ {admin, superadmin}`, is banned, is pending deletion, has an unverified email, or doesn't have `twoFactorEnabled`. It shows a TOTP form. Passkey step-up can come later; it's limited to the app rpID anyway.
3. `POST /api/auth/admin/elevate {code, n, purpose}` is a new plugin `adminElevation` in `packages/auth/admin-elevation.ts`. It re-checks everything in step 2 and verifies TOTP through a shared `verifyTotpStepUp(db, secretConfig, userId, code)`, factored out of `two-factor.ts:36-50,129-165` so it inherits the `lastTotpStep` replay guard. Its rate limit is 5 per 15 min per user, via `customRules` like `index.ts:161-191`. It inserts `admin_elevation_tokens {_id: sha256(token), userId, nonceHash: n, purpose, expiresAt: +60 s}` and returns `https://admin.shortn.at/auth/callback?t=<token>`.
4. `admin.shortn.at/auth/callback` runs `findOneAndDelete({_id: sha256(t), expiresAt > now})`. It requires `sha256(cookie nonce) === nonceHash`; this binds the token to the browser that started the login and blocks login CSRF and session fixation. It re-reads the user (role, ban, deletion), creates the admin session, sets `__Host-shortn_admin`, clears the nonce cookie and writes the audit event `admin.session.create`.
5. **Step-up** reuses the same flow with `purpose=stepup` and an existing admin session. It sets `admin_sessions.elevatedAt` instead of creating a session.

### 1.2 Admin sessions

`admin_sessions`: `{_id: sha256(token), userId, createdAt, lastSeenAt, expiresAt (absolute 8 h), idleUntil (30 min sliding), elevatedAt, ip, uaHash, revokedAt?}`, plus a TTL index on `expiresAt`. The cookie is `__Host-shortn_admin`: HttpOnly, Secure, SameSite=Strict, Path=/, no Domain.

Every request does two indexed reads: the session by `_id`, then the user by `_id`. **Role and ban are re-read from the user doc on every request**, so demotion, ban or deletion takes effect immediately; the role is never snapshotted. The UA hash must match, otherwise the session is revoked. `lastSeenAt` is written at most once per minute.

Revocation: role change, ban, deletion and "sign out everywhere" delete every `admin_sessions` row for the user.

### 1.3 Role model

Reuse `user.role ∈ {user, admin, superadmin}` (unset means `user`), as the old console did (`old:lib/roles.ts:3-10`). Declare it in `packages/auth` additionalFields with `input: false` (F2). Promotion stays a script for the first superadmin; after that only superadmins change roles in the UI (§3.10). Invariants:

- There must always be at least one superadmin, checked inside the transaction.
- Nobody changes their own role.
- A demoted user's admin sessions are deleted.

**Permission matrix** (step-up = `elevatedAt` within 10 min):

| Action | admin | superadmin | step-up | reason required |
| --- | :-: | :-: | :-: | :-: |
| Read every page | ✓ | ✓ | – | – |
| Revoke a user's sessions | ✓ | ✓ | – | ✓ |
| Ban/unban a non-admin user | ✓ | ✓ | ✓ | ✓ |
| Ban an admin | – | ✓ | ✓ | ✓ |
| Suspend/lock or unsuspend a workspace | ✓ | ✓ | ✓ | ✓ |
| Take down / restore a link (≤100 per operation) | ✓ | ✓ | – | ✓ (category) |
| Bulk takedown (>100, ≤1000) | – | ✓ | ✓ | ✓ |
| Resolve/dismiss a report | ✓ | ✓ | – | note optional |
| Limit override or comp ≤ pro for ≤ 90 days; platform feature flags | ✓ | ✓ | ✓ | ✓ |
| Comp enterprise, or for > 90 days / no expiry | – | ✓ | ✓ | ✓ |
| Cancel at period end via Polar | ✓ | ✓ | ✓ | ✓ |
| Immediate revoke or refund via Polar | – | ✓ | ✓ | ✓ |
| Impersonate, read-only | ✓ | ✓ | ✓ | ✓ |
| Impersonate, write-enabled | – | ✓ | ✓ | ✓ |
| Role change | – | ✓ | ✓ | ✓ |
| Domain re-verify | ✓ | ✓ | – | – |
| Domain suspend/remove | ✓ | ✓ | ✓ | ✓ |
| Webhook admin-disable/enable, cancel deliveries | ✓ | ✓ | – | ✓ |
| Job retry/cancel | ✓ | ✓ | – | ✓ (cancel) |
| Contacts triage | ✓ | ✓ | – | – |
| GDPR user deletion | – | ✓ | ✓ | ✓ + typed email |

The matrix lives in one file, `packages/core/admin/permissions.ts`, as a typed `Record<AdminAction, {roles, stepUp, reason}>`. The UI asks the same function whether to render a control. The server enforces it in every action.

### 1.4 MFA

Holding an admin session implies TOTP was verified within the last 60 s of its creation (§1.1 step 3). Users with an admin role and no TOTP are refused with an instruction to enrol. To fix F16, `advancedAuthAvailable`'s callers in `two-factor.ts:90-98,113-122` also allow enrollment when `user.role ∈ admin roles`. Passkey step-up is deferred: passkeys are rpID-bound to `app.shortn.at` and step-up runs there, so it can be added later without admin-side changes.

### 1.5 Rate limiting

Use Redis-backed `consumeAuthRateLimit` (`packages/auth/rate-limit.ts:32-57`) against the cache Redis, keyed `admin:<class>:<adminId>`. The old console's Mongo read-modify-write limiter is non-atomic (`old:lib/rate-limit.ts:45-97`) and is not ported.

| Class | Rule |
| --- | --- |
| read (pages, table queries) | 600 / 60 s |
| mutate | 60 / 60 s |
| sensitive (step-up actions) | 10 / 60 s |
| bulk (selection-wide operations) | 5 / 10 min; each operation also capped by item count (§3) |
| elevation (`/api/auth/admin/elevate`) | 5 / 15 min per user, enforced in apps/web |

### 1.6 CSRF, origin and headers

- Mutations happen only through server actions or POST route handlers. Server actions keep Next's built-in Origin check. Route handlers compare `Origin` with `ADMIN_ORIGIN` from env, **never** with `request.url`: behind the Forge/Caddy proxy, route handlers see the bind host (`forge-infra-quirks`, "Rewrite-origin trap").
- Cookies are SameSite=Strict `__Host-`.
- CSP: `default-src 'self'; frame-ancestors 'none'; form-action 'self' https://app.shortn.at`. No third-party scripts.
- `X-Robots-Tag: noindex`.
- The admin app **never fetches user destinations server-side** (no previews of reported URLs), so it can't be used for SSRF.

### 1.7 Audit log decision: keep `admin_audit_log`, upgraded, write-ahead

Rejected: reusing `audit_log` with an actor kind. Its schema is MCP-specific with required fields (F11), it's workspace-scoped, and the obvious next feature on it, a customer-visible workspace activity log, would leak staff actions. Retention also differs: admin audit is never TTL'd.

Kept: `admin_audit_log`. It's already registered (`packages/db/collections.ts:71,116`) and holds the old console's history (`old:models/AdminAuditLog.ts:30-43`). New rows are a superset of the old shape, so history reads uniformly:

```ts
// packages/db/schemas/index.ts — new entry in `schemas`
admin_audit_log: z.looseObject({
  _id: objectId,
  createdAt: z.date(),
  actorId: text,
  actorEmail: text,
  actorRole: z.enum(["admin", "superadmin"]).optional(),   // absent on legacy rows
  action: text,                                          // "workspace.suspend", "link.takedown", ...
  targetType: z.enum(["user","workspace","link","report","subscription","domain","webhook","job","contact","session"]),
  targetId: text,
  workspaceId: objectId.optional(),
  status: z.enum(["started","succeeded","failed"]).optional(), // absent = legacy row = succeeded
  completedAt: z.date().optional(),
  error: text.optional(),
  reason: text.max(1000).optional(),
  metadata: z.record(text, z.unknown()).optional(),         // { before, after, counts, ... }
  ip: text.optional(),
  userAgent: text.optional(),
  adminSessionId: text.optional(),
  requestId: text.optional(),
}),
```

**Write-ahead** follows `withMcpAudit` (`packages/core/mcp/audit.ts:5-43`): insert `status: "started"` *before* the mutation, and refuse the mutation if that insert fails. Then set `succeeded`/`failed`. The old console swallowed audit failures (`old:lib/admin-guard.ts:119-132`); the new one fails closed. Read-only events that are still logged: impersonation start, PII export (CSV of users), and admin session create/revoke.

### 1.8 Bootstrap and break-glass

- `apps/admin/scripts/promote.ts --email … --role superadmin` runs on the Forge host (`tailscale ssh denizlg24@forge`) against prod Mongo, writes `admin_audit_log` with `actorId: "script"`, and refuses to run without `--yes` (same pattern as `packages/db/cli-target.ts`).
- If apps/web is down, `apps/admin/scripts/break-glass-session.ts` mints a 1 h admin session for an existing superadmin and prints the cookie value. It needs host access, is audited, and is meant to be rare.

---

## 2. Information architecture

### 2.0 Conventions for every list page

- **URL is state.** Filters, search, sort, range and cursor live in search params, so every view is deep-linkable. Server components run the query; there's no client-side fetching of datasets.
- **Keyset pagination**, 50 rows per page. The cursor is `(sortValue, _id)`, so pages stay stable under inserts. Prev/next only; no "page 37 of 9000".
- **Counts** use `countDocuments(filter, {limit: 10_001})` and display "10,000+". With no filter they use `estimatedDocumentCount()`.
- **Facets** reuse `FilterBar`/`FilterField`/`FilterValue` from `@shortn/ui` (`packages/ui/src/components/filter-bar.tsx:19-36`). Every facet is index-backed or bounded; a facet that is neither is shown as a column only.
- **Tables**: add a generic `DataTable` to `@shortn/ui`, built on `@tanstack/react-table` + `@tanstack/react-virtual` (both already dependencies of `@shortn/ui`). It follows the dense styling and keyboard model of `LinksTable` (`packages/ui/src/components/links-table.tsx:156-692`). Long values are truncated with full text in a tooltip, and columns reflow to a stacked row under 900 px. This follows the AGENTS.md large-library rules.
- **Selection** spans pages and filters: either explicit IDs, or "all N matching this filter" with the frozen filter echoed back. The UI always shows the selection count and the operation cap.
- **Charts**: extend `TimeSeriesChart` (`packages/ui/src/components/time-series-chart.tsx:27-35,75-141`), which is single-series today, to multi-series lines and stacked areas. The range selector offers 7d / 30d / 90d / 12m / custom. The interval is derived: day up to 90 d, week up to 12 m, month beyond.
- **Write actions** are full pages, not sheets or popovers, e.g. `/workspaces/[id]/suspend`. Each has a form, a reason field, a preview of effects ("412 links will stop redirecting; 3 bio pages; 1 custom domain") and typed confirmation for destructive ones. The page returns to the detail view. Trivial toggles (report reviewed, contact status) are inline.
- **Detail pages** use tabs as sub-routes (`/workspaces/[id]/links`), each paginated on its own.

### 2.1 Overview `/`

Range selector at the top. The headline numbers are one dense text strip (`StatStrip`): value for the range plus the delta against the previous equal range. There are no stat cards.

| Panel | Series / content | Source | Index |
| --- | --- | --- | --- |
| Growth | signups/day, verified signups; personal vs team workspaces created/day | `platform_daily` (§2.11) | `_id` (day string) |
| Links | links created, QR codes created, demo links | `platform_daily` | — |
| Traffic | human clicks, QR scans, bot hits | `platform_daily` (computed from `click_rollups` and Redis `bots:<day>` hashes, `apps/worker/src/ingest.ts:291-296`) | new `click_rollups {day:1}` |
| Ingest health | click rejects/day, top reject reasons | `platform_daily`; live "today" from `click_rejects` | new `click_rejects {at:1}` |
| Revenue | list-price MRR (daily snapshot), active paid subscriptions stacked by plan, domain add-ons, Polar-reported revenue | `platform_daily.billing`; Polar Metrics API cached 15 min in Redis (endpoint and fields to verify in sandbox before relying on them) | — |
| Churn | cancellations/day, churn % for the range (canceled ÷ active at range start) | `platform_daily` (from `billing_events` type `subscription.canceled`/`revoked`) | existing TTL index `billing_events {receivedAt:1}` doubles as a range index (`packages/db/indexes.ts:395-401`) |
| Billing reconcile | last run (time, checked, corrected, unmapped, orphaned) and drift sparkline over the last 30 runs | `billing_reconcile_runs` (`apps/worker/src/billing.ts:142-154`) | new `{at:-1}` |
| Queues (live, 30 s poll) | per job type: backlog, running, stuck (lease expired), oldest pending age, failed 24 h, failure rate 24 h / 7 d | §2.9 queries | existing due indexes |
| Webhooks | attempts/day and failure rate; endpoints failing now; auto-disabled in range | `platform_daily`, `webhook_endpoints` | new `webhook_attempts {createdAt:1}`, new partial `webhook_endpoints {failureSince:1}` |
| Moderation | open reports, auto-blocked links awaiting review, takedowns/day, suspended workspaces | `link_reports`, `links`, `admin_audit_log` | new (§2.12) |

"MRR" here means **list-price MRR**: Σ `plans[plan].priceUsdMonthly` over mirrored subscriptions with status in `paidStatuses` (`packages/billing/entitlements.ts:14`; prices at `packages/billing/catalog.ts:42-120`), plus $5 per active domain add-on. Custom-priced enterprise (`priceUsdMonthly: null`) is counted separately. It's labeled as list price. Polar's reported revenue sits beside it as the authoritative money number.

### 2.2 Workspaces `/workspaces`

| Column | Source |
| --- | --- |
| Name / slug | `workspaces` |
| Owner (email) | `user` by `ownerUserId`; batch `$in` per page |
| Type (personal/team) | `workspaces.personal` |
| Effective plan + markers (comp, override, past_due, cancel at period end) | `subscriptions` batch `$in` per page (`v2_workspace_subscriptions`) + `workspaces.entitlementOverride` |
| Members | `workspace_members` `$group` over the page's IDs (`v2_membership` prefix) |
| Clicks 30d | `workspace_daily` (§2.11) for the page's IDs |
| Status (active/locked/suspended) | `workspaces.suspension` |
| Created | `_id` time |

- **Facets:** plan (from `workspaces.plan`, the snapshot `applyFetched` keeps current at `packages/billing/polar.ts:195-199`; new index `{plan:1,_id:-1}`); status (new partial index on `suspension.at`); type (`{personal:1,_id:-1}` new); "has override/comp" (new partial index); "has custom domain" (via the `domains` collection, small, as an `$in` list).
- **Search:** exact slug or slug prefix (`v2_workspace_slug`); owner email resolves to a user, then `v2_member_user` gives memberships; exact ObjectId.
- **Sort:** created desc/asc (`_id`). For "top by clicks", a separate view aggregates `workspace_daily` over the range (`$group`, sort, limit 100). That's bounded by active workspaces per day, not by collection size.

**Detail `/workspaces/[id]`**: one summary header line, then tabs.

- **Overview tab:** clicks/scans time series (`workspace_daily`); usage vs entitlement meters for links, QR and bio this period (`countUsage`, `packages/core/usage/service.ts:11-47`, against `Entitlements.limits`, rendered with `UsageMeter`); effective entitlements with every source shown: plan from subscription, comp, limit overrides, platform-feature overrides with their rollout default.
- **Members tab:** `workspace_members` by `workspaceId`, with user email, role, joined and 2FA; plus pending invites (`v2_invite_workspace`).
- **Billing tab:** mirror subscriptions (`v2_workspace_subscriptions`), domain add-ons (`domain_addon_workspace`), and Polar orders for the customer, fetched live and paginated through Polar (`polar.orders.list({customerId})`).
- **Domains tab:** `domain_workspace_cursor`.
- **API keys tab:** `v2_workspace_api_keys` — prefix, scopes, created by, last used, expires, revoked.
- **Webhooks tab:** `webhook_workspace_cursor` plus delivery stats.
- **Links tab:** the Links page (§2.4) pre-filtered by workspace, using `v2_workspace_created`.
- **Audit tab:** two streams — this workspace's MCP `audit_log` (`audit_workspace_cursor`) and the `admin_audit_log` rows for the workspace (new `{workspaceId:1,_id:-1}`).
- **Jobs tab:** imports and exports by workspace (`import_workspace`, `export_kind_workspace`, `qr_*_workspace`).

### 2.3 Users `/users`

| Column | Source |
| --- | --- |
| Email / name / username | `user` |
| Created | `_id` time |
| Verified | `emailVerified` |
| Role | `role` |
| Status (active, banned until …, pending deletion) | `banned`, `banExpires`, `deletion` |
| 2FA | `twoFactorEnabled`; passkey count from `passkey` (`passkey_user_cursor`) per page |
| Sign-in methods | `account.providerId` per page (new `account {userId:1}`) |
| Workspaces | `workspace_members` per page (`v2_member_user`) |
| Last sign-in | `sign_in_events` (§3.1) or max `session.createdAt` per page (new `session {userId:1}`) |

- **Facets:** role (new partial `{role:1,_id:-1}` where role exists); status (new partial on `banned:true`, new partial on `deletion.requestedAt`); 2FA (new partial on `twoFactorEnabled:true`); verified (no index; it's evaluated on an `_id`-ordered scan with early termination at 50 matches; fine at current scale, and flagged).
- **Search:** email prefix on lowercased input, using the legacy unique `email` index. Confirm its existence in prod with `bun run --cwd packages/db db:indexes --dry-run`. Also exact `_id`, exact `sub` (legacy unique), exact username.
- **Sort:** created (`_id`).

**Detail `/users/[id]`**: profile and status header, then tabs.

- **Workspaces tab:** role, owner flag, plan, suspension.
- **Security tab:** 2FA enrolled (the `twoFactor` row exists; never show secrets), passkeys (name, created, last used), SSO bindings (`sso_user_workspace`), OAuth connected accounts, MCP OAuth consents and tokens.
- **Sessions tab:** active `session` rows (created, expires, IP, UA, geo; `packages/auth/index.ts:368-379,384-397`). Impersonated sessions are flagged with `impersonatedBy`.
- **Sign-in history tab:** `sign_in_events` (new, §3.1) plus legacy `loginrecords` by `sub`, the same read the old console did (`old:app/api/admin/users/[id]/route.ts:39-40`). Legacy records stop wherever legacy stopped writing them; the rebuild never wrote them.
- **Admin audit tab:** rows targeting the user, and rows where they're the actor if they're staff.
- **Contacts tab:** `contacts` by email (legacy `{email,status}` index prefix).

### 2.4 Links `/links`

Cross-workspace search. Search input modes are auto-detected:

- **Short URL or code.** A pasted `https://dom/key` is parsed. `urlCode` exact uses `v2_legacy_code`, `{domain,key}` exact uses `v2_domain_key`, and old keys use `v2_previous_keys`.
- **Destination host.** Matches exactly or including subdomains, via `destHostRev` prefix. This mode is **available only after phase E** (§4); until then it falls back to exact `longUrl` equality, which has no index and is disabled once the collection exceeds 1 M docs.
- **Link ID or workspace slug.**

| Column | Source |
| --- | --- |
| Short link (domain/key, copy) | `domain`, `key`/`urlCode` |
| Destination (host + truncated path) | `longUrl` |
| Workspace | batch lookup per page |
| Created by | `createdBy` → user per page |
| Created | `_id` |
| Clicks | `stats.clicks`/`clicks.total` |
| Safety | `safetyStatus`, `safety.provider`, `safety.lastScannedAt` |
| Moderation | `moderation.state`/`category`, `disabledReason` |
| Reports | `reportCount` |
| Flags | password, interstitial, rules, archived, trashed, demo |

- **Facets:**
  - safety ∈ {suspicious, malicious, blocked}: new partial `{safetyStatus:1,_id:-1}` where `safetyStatus ∈ […]`
  - moderation taken down: new partial `{"moderation.at":-1}`
  - has reports: new partial `{reportCount:-1,_id:-1}` where `reportCount > 0`
  - workspace: `v2_workspace_created`
  - custom domain: `v2_domain_key`, sorted by key
  - trashed: `v2_link_trash_cleanup`
  - created range: `_id` range
  - demo: bounded by the 24 h demo lifetime

  Facets that can't use an index alone (e.g. "pending" safety across all links) are not offered.
- **Sort:** newest (`_id`). Within a workspace: newest/oldest (`v2_workspace_created`). Within a custom domain: key. Most reports: partial index.
- **Bulk:** take down or restore, up to 100 selected (admin) or 1,000 (superadmin). "All matching" is allowed only on index-backed facets and freezes the ID list at confirmation time.

There's no detail page of its own. A row opens `/links/[id]` with a full-page view: link fields; rules summary; safety scan history (`safetyScan`, `health.checks`); reports for the link; a click series (`click_rollups` by `v2_link_day`); and audit.

### 2.5 Reports and safety queue `/reports`

The queue is **grouped by link**:

```js
link_reports.aggregate([
  {$match: {status: "open"}},
  {$sort: {createdAt: -1}},
  {$group: {_id: "$linkId", count: {$sum: 1}, reasons: {$push: "$reason"},
            first: {$min: "$createdAt"}, last: {$max: "$createdAt"}}},
  ...
])
```

It runs on a new index `{status:1, linkId:1, createdAt:-1}`. The open set is small by nature. Groups are paginated by `(last, _id)`.

| Column | Source |
| --- | --- |
| Link | `links` by ID per page |
| Destination host | `longUrl` |
| Reasons (counts per reason) | aggregated `reason` (legacy enum `legacy/models/url/LinkReport.ts:10-13`) |
| Reports | group count |
| First / last reported | group min/max |
| Link state (live, auto-blocked, taken down, deleted) | `disabled`, `disabledReason`, `moderation` |
| Scan verdict | `safetyStatus`, `safety.provider` |
| Workspace (plan, age, prior takedowns) | workspace and `admin_audit_log` count per page |

- **Facets:** reason; link state; workspace plan (free accounts are the usual abuse signal); "new workspace (<7 d)".
- **Sort:** most reports, oldest open, newest.
- **Row expansion (in-page):** the individual reports (details text, time) and the stored OG/title. No live fetch of the destination.
- **Actions:** Take down (category), Dismiss (restores if the link was auto-blocked), Mark reviewed, no action.

A secondary tab, **Auto-blocked**, lists links with `disabledReason: "auto:report-threshold"` (`packages/core/links/public.ts:237`) and no `moderation` (partial index), so the auto-block path always gets a human decision.

### 2.6 Domains `/domains`

`domains` is small (paid add-on), so a paginated scan is fine.

- **Columns:** hostname, workspace, kind, status, hostname status, SSL status, verified at, next attempt, removing, add-on subscription status, last error, created.
- **Facets:** status (`pending|active|failed|disabled|suspended`, `packages/db/schemas/index.ts:415-428`), SSL status, kind, removing.
- **Sort:** created; next attempt (`domain_poll_due`).
- **Row actions:** Re-verify now, Suspend, Remove.

### 2.7 Webhooks `/webhooks`

- **Endpoints view:**
  - Columns: name, URL host, workspace, events, state (healthy / failing since X / auto-disabled / owner-disabled / admin-disabled), deliveries 24 h (delivered/failed), last delivery status.
  - Facets: state (new partial `{failureSince:1}`; `enabled:false` is small).
  - Sort: failing longest first.
- **Deliveries view** for one endpoint: `webhook_delivery_cursor`, then attempts (`webhook_attempt`).
- **Actions:** admin-disable or enable; cancel pending deliveries.

### 2.8 Billing `/billing`

This is parity with the old Subscriptions page, now workspace-aware.

- **Subscriptions tab:** the mirror `subscriptions`.
  - Columns: workspace, plan, status, period end, cancel at period end, scheduled change, Polar IDs, modified.
  - Facets: plan, status (new `{status:1, plan:1, _id:-1}`; small collection).
- **Events tab:** `billing_events`.
  - Columns: type, received, processed, attempts, error, locked until.
  - Facets: unprocessed (`processedAt` missing), dead (`attempts ≥ 10`, `apps/worker/src/billing.ts:37`), type.
- **Reconcile runs tab:** `billing_reconcile_runs`, plus historical `billing_shadow_diffs` (read-only).
- **Overrides & comps tab:** workspaces with an active `entitlementOverride` (partial index).

### 2.9 Jobs `/jobs`

One tab per job type. Each tab shows a live summary (counts by state, stuck, oldest pending) above a filtered table.

| Type | Collection | Summary query (index) | Table facets |
| --- | --- | --- | --- |
| Imports | `import_jobs` | `$group` by state; the collection is TTL-bounded (`import_expiry`) | state, kind |
| Link / analytics / workspace exports | `export_jobs` | by kind × state (`export_kind_due`) | kind, state |
| QR exports / QR zips | `qr_export_jobs`, `qr_zip_jobs` | by state (`qr_*_due`) | state |
| Bio delivery | `bio_delivery_jobs` | due count (`bio_delivery_due`) | — |
| Webhook deliveries | `webhook_deliveries` | by status (`webhook_delivery_due`), stuck (`webhook_delivery_lease`) | status |
| Billing events | `billing_events` | unprocessed, dead | type |
| Safety scans / health / rule schedules | `links` subdocs | due counts, capped at 10k (`v2_safety_scan_due`, `v2_health_due`, `v2_rule_schedule_due`) | — |
| Domain provisioning | `domains` | due (`domain_poll_due`) | — |
| Click stream | durable Redis | `XLEN clicks:stream`, `XPENDING` summary for the ingest group, rejects today | — |
| Worker loops | new `worker_heartbeats` | last run, duration and error per loop name from `apps/worker/src/index.ts` `every(...)` | — |

"Stuck" means state `running` (or `sending`) with `leaseUntil < now`. Failure rate is `failed ÷ (completed + failed)` among rows created in the window; the collections are TTL-bounded, so a scan is acceptable.

`worker_heartbeats` is new. The worker records `{_id: loopName, lastRunAt, lastDurationMs, lastError?, lastErrorAt?}`, throttled to once every 30 s per loop, from a wrapper around `every()`. Without it, a dead loop is invisible except through growing backlog.

### 2.10 Contacts `/contacts` and Audit `/audit`

**Contacts.**
- **Columns:** ticket ID, received, name, email (linked to a user if one matches), company, subject, message preview, triage status, assignee.
- **Facets:** status (new `triage` subdocument; absent means `new`; new index `{"triage.status":1, createdAt:-1}`), subject.
- **Sort:** newest (legacy `createdAt:-1` index).
- **Actions:** set status, assign, internal note, "reply" (a `mailto:` with the ticket ID in the subject; there's no outbound mail from the admin in v1).

**Audit.**
- **Columns:** time, actor, action, target (linked), workspace, status, reason, IP.
- **Facets:** action group, actor, target type, status.
- **Range:** yes.
- **Indexes:** new `{createdAt:-1}`, `{actorId:1,createdAt:-1}`, `{targetType:1,targetId:1,createdAt:-1}`, `{workspaceId:1,_id:-1}`. Legacy single-field indexes from `old:models/AdminAuditLog.ts:31-38` may already exist; `syncIndexes` leaves them and logs drop suggestions (`packages/db/indexes.ts:548-553`).

### 2.11 Platform rollups (worker job `platform-metrics`)

The overview must not aggregate raw collections on page load. A new worker loop, `apps/worker/src/platform-metrics.ts` (every 5 min), recomputes **today and yesterday**. On first run it backfills up to 400 days, one day per tick. The backfill window is bounded by the `billing_events` and `bio_views` TTLs.

`platform_daily` has one document per UTC day, `_id: "2026-10-19"`:

| Field | Computed from |
| --- | --- |
| `users.signups`, `users.verified` | `user` `_id` ObjectId range (uses `_id_`; no new index) |
| `workspaces.personal/team` | `workspaces` `_id` range |
| `links.created/demo`, `qr.created` | `links`/`qr_codes` `_id` range. Attribution is by `_id` time, which is creation time for legacy, rebuild and import inserts. |
| `clicks.human/scans` | `click_rollups` `{day}` sum (new `{day:1}`) |
| `clicks.bots` | durable Redis `HVALS bots:<day>` sum |
| `rejects` | `click_rejects` `{at}` range (new index) |
| `bioViews` | `bio_views` `ts` range (existing TTL index `bio_view_retention`) |
| `reports.opened/resolved`, `moderation.takedowns/suspensions/bans` | `link_reports` (new `{createdAt:-1}`), `admin_audit_log` |
| `billing.mrrListUsd`, `billing.activeByPlan`, `billing.addons`, `billing.newPaid`, `billing.canceled` | `subscriptions` snapshot (today only; history begins when the job ships), `domain_addons`, `billing_events` range |
| `webhooks.attempts/failures` | `webhook_attempts` `{createdAt}` range (new index); failure = status 0 or ≥ 400 |
| `jobs.<kind>.created/failed` | job collections by `_id` range |

`workspace_daily` is keyed `{workspaceId, day}`, unique, with `clicks`, `scans` and `linksCreated`. It's derived from the same one-day `click_rollups` read, grouped by `workspaceId`, and gets a second index `{day:1, clicks:-1}` for "top workspaces".

### 2.12 Index plan

`syncIndexes` creates indexes but never drops or replaces them (`packages/db/indexes.ts:492-568`). All new indexes go into `desiredIndexes` and are applied with `db:indexes --dry-run`, then `--yes`.

| Collection | Index | Exists? | Build risk |
| --- | --- | --- | --- |
| `links` | `v2_legacy_code`, `v2_domain_key`, `v2_previous_keys`, `v2_workspace_created`, `v2_safety_scan_*`, `v2_link_trash_cleanup` | yes (`indexes.ts:294-338`) | — |
| `links` | `admin_risky {safetyStatus:1,_id:-1}` partial `safetyStatus ∈ [suspicious, malicious, blocked]` | **new** | full collection scan to build; small result. Build off-peak. |
| `links` | `admin_moderated {"moderation.at":-1}` partial `moderation` exists | **new** | same |
| `links` | `admin_reported {reportCount:-1,_id:-1}` partial `reportCount > 0` | **new** | same |
| `links` | `admin_dest_host {destHostRev:1,_id:-1}` | **new, phase E only** | needs a backfill (§4 E) |
| `user` | `email` unique, `sub` unique | legacy mongoose — **verify in prod** | — |
| `user` | `admin_role {role:1,_id:-1}` partial role exists; `admin_banned {banned:1,_id:-1}` partial `banned:true`; `admin_deletion {"deletion.purgeAfter":1}` partial; `admin_2fa {twoFactorEnabled:1,_id:-1}` partial `twoFactorEnabled:true`. (Mongo treats a bare `{_id:-1}` key as an `_id` index spec and rejects a partial filter on it, so the flag leads.) | **new** | small |
| `session` | `session_user {userId:1}` | **new** (also speeds better-auth `listSessions`) | moderate |
| `account` | `account_user {userId:1}` | **new** | small |
| `workspaces` | `admin_plan {plan:1,_id:-1}`, `admin_type {personal:1,_id:-1}`, `admin_suspended {"suspension.level":1,"suspension.at":-1}` partial `suspension.level` exists (the level prefix lets the redirect's `{"suspension.level":"suspended"}` load use it), `admin_override {"entitlementOverride.grantedAt":-1}` partial | **new** | small |
| `link_reports` | `report_queue {status:1,linkId:1,createdAt:-1}`, `report_link_ip {linkId:1,reporterIpHash:1}`, `report_time {createdAt:-1}` | **new** (legacy has `urlCode`, `status` singles) | small |
| `click_rollups` | `v2_link_day`, `v2_workspace_day` | yes | — |
| `click_rollups` | `rollup_day {day:1}` | **new** | moderate (one doc per active link per day) |
| `click_rejects` | `reject_time {at:1}` + TTL 90 d | **new** | small |
| `webhook_attempts` | `attempt_time {createdAt:1}`, `attempt_endpoint_time {webhookId:1,createdAt:-1}` | **new** | TTL-bounded |
| `webhook_endpoints` | `endpoint_failing {failureSince:1}` partial exists | **new** | small |
| `subscriptions` | `admin_status_plan {status:1,plan:1,_id:-1}` | **new** | small |
| `billing_reconcile_runs` | `{at:-1}` | **new** | tiny |
| `contacts` | `contact_triage {"triage.status":1,createdAt:-1}` | **new** | small |
| `admin_audit_log` | four compounds (§2.10) | **new** | small |
| `admin_sessions` | TTL `{expiresAt:1}`, `{userId:1}` | **new collection** | — |
| `admin_elevation_tokens` | TTL `{expiresAt:1}` | **new collection** | — |
| `platform_daily`, `workspace_daily`, `worker_heartbeats`, `platform_notifications`, `sign_in_events` | as described; `sign_in_events` has `{userId:1,at:-1}` and a 90-day TTL on `at` that expires the whole event (raw IP retention) | **new collections** | — |

`syncIndexes` refuses to run if a legacy collection is missing (`indexes.ts:503-507`). `admin_audit_log` is listed as legacy (`collections.ts:116`), so it has to exist in every environment. Staging and dev fixtures must create it.

---

## 3. Write actions

**Shared shape.** Every action is a function in `packages/core/admin/*.ts` with the signature `(ctx: AdminContext, input) => Promise<Result<…>>`, where `AdminContext = { db, cache: InvalidationStore, durable?, admin: {id, email, role}, session: {id, elevatedAt}, request: {ip, ua, requestId}, linkDomain, now }`. Each one:

1. checks permissions (§1.3);
2. validates input with zod;
3. writes the `started` audit row;
4. mutates, inside `withMutation`/transactions where multi-document;
5. invalidates caches;
6. enqueues notifications;
7. completes the audit row.

The admin UI only calls these functions. Integration tests run them against the existing Mongo/Redis test harness (`REQUIRE_INTEGRATION`, `MONGO_TEST_URL`; `turbo.json` test env).

When an action has to call a workspace-scoped core service (`removeDomain`, `cancelImport`, …), it builds a `ServiceContext` with a **platform actor**. There's precedent: workers already construct `actor: {userId, role: "owner"}` (`apps/worker/src/workspace-export-notice.ts:63-69`, `packages/core/links/service.ts:1399-1403`). Extend `Actor` (`packages/core/workspaces/authz.ts:34-37`) with an optional `via?: {kind: "platform", adminId}` so webhook events and downstream records can attribute the change.

**Notifications** go through a new outbox, `platform_notifications {_id: idempotencyKey, kind, to, payload, createdAt, sentAt?, attempts, nextAttemptAt}`, drained by the worker with the existing mailer. That keeps SMTP credentials out of the admin app and follows the `webhook_notifications`/`domain_notifications`/`billing_mail` pattern. New `@shortn/emails` methods: `accountSuspended`, `workspaceSuspended`, `workspaceRestored`, `linkRemoved`, `accountDeletionScheduled`.

### 3.1 Ban / unban user, revoke sessions

**Semantics.**
- *Ban* blocks every way of authenticating as the user, kills existing sessions, and disables credentials derived from the user: API keys they created and their MCP OAuth tokens.
- Bans can be timed (`banExpires`); expiry is evaluated at check time and there's no unban job.
- *Unban* clears the ban fields. It doesn't restore sessions or keys; keys simply authenticate again.
- *Revoke sessions* deletes sessions only.
- Banning a user doesn't suspend their workspaces. A checkbox, "also suspend workspaces where they're the sole owner", chains §3.2.

**Data model** (`packages/db/schemas`: new `schemas.user` as a looseObject subset):

```ts
user: z.looseObject({
  _id: objectId, email: text, name: text.optional(), emailVerified: z.boolean().optional(),
  createdAt: z.date().optional(), sub: text.optional(), username: text.optional(),
  twoFactorEnabled: z.boolean().optional(), lastWorkspaceId: text.nullable().optional(),
  role: z.enum(["user", "admin", "superadmin"]).optional(),
  banned: z.boolean().optional(), banReason: text.optional(), banExpires: z.date().optional(),
  bannedAt: z.date().optional(), bannedBy: text.optional(),
  deletion: z.object({ requestedAt: z.date(), by: text, purgeAfter: z.date(),
    state: z.enum(["scheduled", "purging", "done"]) }).optional(),
  deletedAt: z.date().optional(),
}),
```

Declare `role`, `banned`, `banReason`, `banExpires` and `deletion` in `packages/auth/index.ts:202-226` with `input: false`. No migration: absent means not banned.

**Enforcement points:**

| Where | Change |
| --- | --- |
| `packages/auth/index.ts:349-381` `session.create.before` | Look up `{banned, banExpires, deletion}` by `session.userId` and throw `APIError("FORBIDDEN", {code: "ACCOUNT_SUSPENDED"})` when banned and unexpired, or when deletion is scheduled. This one hook covers password, username, OAuth, passkey, SSO and **handoff** (`handoff.ts:84-94` calls `createSession`, which runs the hook). The login UI maps the code to a message. |
| `packages/core/api-keys/service.ts:241-248` `authenticateApiKey` | Add the creator user `{banned, banExpires, deletion}` to the existing `Promise.all` and fail `unauthorized`. One extra indexed read per API request; acceptable, or cache it 60 s in the cache Redis. |
| `packages/core/mcp/oauth.ts:33-144` `authenticateMcpOAuth` | Same check on the token's user. |
| `legacy/lib/auth.ts:256` `session.create` hook | Same check until P7. Legacy shares the `session` collection and is still deployed. |
| Revocation in the action | Delete `session` rows (`{userId: {$in: [id, ObjectId(id)]}}`, F18), `handoff_tokens` by `userId`, `oauthAccessToken`/`oauthRefreshToken` by user, `verification` trust-device rows (same filter as `index.ts:285-287`), and `admin_sessions`. |
| `sign_in_events` (new, `session.create.after`) | Append `{userId, at, method: ctx.path, ip (90 d TTL, per the raw-IP retention decision), country, uaHash}`. This gives the Users page a real login history. |

**Reversibility:** full (unban). **Audit:** `user.ban`/`user.unban`/`user.sessions.revoke` with the reason and expiry.

**User-facing:**
- Sign-in fails with "This account is suspended. Contact support@…" plus the public reason if set.
- An `accountSuspended` email goes out on ban, with an option to suppress it for spam accounts.
- Pending invites from the user stay valid; admins can revoke them from the workspace page.

### 3.2 Suspend / lock / unsuspend workspace

**Semantics.** Two levels (Q4):
- **lock**: the dashboard and API become read-only, but links, bio pages and domains keep serving. Use it for billing disputes, ownership disputes and investigations.
- **suspend**: lock, plus all public delivery stops: redirects, bio pages, custom domains, outgoing webhooks. Use it for abuse.

Exports stay allowed at both levels (data portability).

**Data model:**

```ts
// workspaceSchema (packages/db/schemas/index.ts:240-262)
suspension: z.object({
  level: z.enum(["locked", "suspended"]),
  category: z.enum(["abuse", "phishing", "malware", "spam", "fraud", "chargeback", "legal", "nonpayment", "other"]),
  publicNote: text.max(500).optional(),
  internalNote: text.max(2000),
  by: text, at: z.date(),
}).optional(),
```

`workspaceSchema` is a strict `z.object`, but nothing parses workspace docs through it (checked: no `workspaceSchema.parse` callers), so adding fields is type-only. No migration.

**Enforcement points:**

| Where | Change |
| --- | --- |
| New `packages/core/workspaces/status.ts` | `workspaceAccess(workspace) → "active" \| "locked" \| "suspended"` and `assertWritable(workspace)`. |
| `apps/web/src/app/[workspace]/layout.tsx:44-89` | When `suspension` is set, render a full-page `WorkspaceSuspended` screen (category, public note, contact link, *Export data* and *Billing* links) instead of `children`, except under `/settings/billing` and `/settings/workspace/exports`. |
| `apps/web/src/server/context.ts:10-19` `serviceContext` | Call `assertWritable`; this one choke point serves about 136 callers (`graft callers serviceContext`). Exports and billing actions use `serviceContext(slug, {allowSuspended: true})`. Also `apps/web/src/server/actions/settings-pages.ts`, which uses `requireWorkspace` directly. |
| `authenticateApiKey` / `authenticateMcpOAuth` (§3.1) | Locked: allow `GET` only. Suspended: deny all with `403 workspace_suspended`. The method check sits in `apps/api/src/rest.ts:543-579` after the principal is resolved, and in `apps/api/src/mcp.ts:108-112` (MCP: read tools only when locked). |
| Redirect hot path, suspended only | `apps/redirect` keeps an in-process `Set<workspaceId>` of suspended workspaces. It's loaded at boot from `workspaces.find({"suspension.level": "suspended"}, {_id: 1})` (partial index), refreshed every 30 s, and updated immediately through a new pub/sub channel, `workspace-suspension`, on the existing subscriber (`apps/redirect/src/index.ts:21-31`). After `resolver.resolve()`, a `link` whose `ws` is in the set is treated as `status: "blocked"`, so it goes to the safety page (`packages/core/links/decide.ts:96-101`). **No link documents are touched and no mass cache invalidation is needed.** |
| `packages/core/links/public.ts:45-82` `publicLink` | Treat a suspended workspace as `blocked` with reason `workspace:suspended`. Otherwise the safety page would show a *Continue* button for a non-blocked link. `apps/web/src/app/safety/[key]/page.tsx:87-99` gets copy for the new reason. |
| Bio: `packages/core/bio/publishing.ts:374` `resolveBioDocument` and `apps/web/src/server/public-bio.ts:14-19,49-56` | Live check (outside `unstable_cache`) → `notFound()`. On suspend, enqueue `bio_delivery_jobs` for the workspace's pages. The existing outbox revalidates the tag and purges Cloudflare URLs (`apps/worker/src/index.ts` `bio-invalidation` loop). Without that, the residual is the edge's 60 s TTL plus one stale-while-revalidate serve (`apps/edge/src/index.ts:326-350`). |
| `packages/core/domains/service.ts:662-682` `activeDomain` | Require that the workspace isn't suspended (one projected read). This covers custom-domain root redirects and bio-by-domain. |
| Worker: `apps/worker/src/imports.ts:77` `runImport` | Fail with `workspace_suspended` when locked or suspended (it's a write). |
| Worker: outgoing webhooks (`outgoing-webhooks.ts:53` endpoint filter) | Skip suspended workspaces. Deliveries stay pending until `retryUntil` and then fail normally; unsuspend within the window resumes them. |
| Worker: safety scans, health, metadata, rule schedules, billing | Unchanged. Scans must keep running. |
| Legacy fallback: `legacy/app/api/get-long-url/[slug]/route.ts:25-32` | Until P7, one extra `workspaces.findOne({_id: urlDoc.workspaceId, "suspension.level": "suspended"})` read, used only when the edge falls back (F8). |

**Reversibility:** full (unsuspend clears the field, publishes on the channel and re-enqueues bio invalidation). **Audit:** `workspace.lock` / `workspace.suspend` / `workspace.unsuspend` with counts (links, bio pages, domains) in metadata.

**User-facing:**
- Every member sees the suspended screen.
- The owner gets a `workspaceSuspended` email (category, public note, appeal via the contact form with the ticket subject prefilled), and `workspaceRestored` on unsuspend.
- Visitors to links of a suspended workspace see "This link is unavailable" with no destination shown.

### 3.3 Link takedown / restore

**Semantics.** A takedown is a staff decision the owner can't undo. The link stops redirecting, owners can't edit it (delete is allowed; the record survives in trash for evidence), and visitors see a removal notice. Restore returns the link exactly to its pre-takedown state and queues a rescan.

**Data model:**

```ts
// linkSchema (packages/db/schemas/index.ts:101-225)
moderation: z.object({
  state: z.literal("taken_down"),
  category: z.enum(["phishing", "malware", "spam", "illegal", "copyright", "impersonation", "other"]),
  publicNote: text.max(500).optional(),
  internalNote: text.max(2000).optional(),
  reportIds: z.array(objectId).max(100).optional(),
  by: text, at: z.date(),
  previous: z.object({
    disabled: z.boolean(), safetyStatus: text.optional(), disabledReason: text.optional(),
  }),
}).optional(),
```

The takedown write, a single `findOneAndUpdate`:
- sets `moderation`;
- sets `disabled: true`, `disabledReason: "admin:takedown"`, `safetyStatus: "blocked"`;
- mirrors them into `safety.disabled`, `safety.status`, `safety.disabledReason`, as `reportLink` does (`public.ts:228-243`).

The legacy fields are what make legacy fallback, the existing `disabled` status filter (`packages/core/links/service.ts:1497-1503`), the API `safety` view (`service.ts:154-159`) and rescans (`service.ts:1619-1620`, never downgrades `blocked`) all behave without further changes. No migration.

**Enforcement points:**

| Where | Change |
| --- | --- |
| `packages/core/links/cached-link.ts:68-115` | Add `"moderation.state": 1` to `linkProjection` and treat it as `blocked` in `toCachedLink` (defense in depth if the legacy fields are ever cleared). |
| `packages/core/links/service.ts:997` `updateLink` (and bulk tag/campaign/archive services) | Return `fail("taken_down")` when `moderation` is set. Tags/archive could arguably be allowed; recommend blocking everything except delete, for simplicity. |
| Cache | Explicit `invalidateLinks(cache, link.domain ?? linkDomain, [urlCode, key, ...previousKeys])`. The change-stream invalidator also fires, but only for the root domain (F7). Redirect responses aren't edge-cached (`apps/redirect/src/app.ts:50-56` `private, max-age=0`), so no CDN purge is needed. |
| `apps/web/src/app/safety/[key]/page.tsx:87-99` | Copy for `admin:takedown` with the category ("removed for violating Shortn's terms — phishing"). |
| Dashboard link pages (`apps/web/src/app/[workspace]/links/[id]/page.tsx:145,274-278`) | A "Removed by Shortn Trust & Safety: <category>. <appeal link>" banner. Edit controls are hidden. |
| REST/MCP link views | Add read-only `moderation: {state, category}`. |
| Webhook | Emit `link.updated` through `recordWebhookEvent`, as the auto-block path does (`public.ts:252-271`). |

**Restore:**
- Restores `moderation.previous` (if `previous.disabled` was false, clear `disabled`/`disabledReason`; set `safetyStatus` to `previous.safetyStatus ?? "pending"`).
- Unsets `moderation`.
- Sets `safetyScan.dueAt = now` so the scanner re-evaluates.
- Invalidates the cache.

For **auto-blocked** links (no `moderation`), "Dismiss + restore" clears `disabled` only when `disabledReason === "auto:report-threshold"`, and resets the report counters to 0.

**Bulk:** the same per-link function in batches of 50. Admins are capped at 100 and superadmins at 1,000, with a progress page. One audit row per link plus a parent row `link.takedown.bulk` with the frozen filter.

**Audit:** `link.takedown` / `link.restore` with category, report IDs and `previous`.

**User-facing:** the workspace owner gets a `linkRemoved` email (link, category, public note, appeal), batched per workspace for bulk operations.

### 3.4 Entitlement overrides and plan comp

**Decision:** a single local override on the workspace, not Polar-side comps (Q3). The alternative was $0 Polar products with `shortn_plan` metadata created per comp. They would flow through `applyFetched`/`planForProduct` (`packages/billing/polar.ts:136-201`) and reconcile (`:227-261`) unchanged. But they need four extra Polar products, the API's support for creating free subscriptions programmatically (to verify), $0 renewal orders that would trigger receipt mail (`apps/worker/src/billing-receipts.ts`), and they can't express limit overrides at all. The local override covers both comps and limits in one mechanism.

**Data model:**

```ts
// workspaceSchema
entitlementOverride: z.object({
  plan: workspaceSchema.shape.plan.optional(),            // comp: floor plan
  limits: z.object({
    links: z.number().int().nonnegative().nullable(), qrCodes: ..., bioPages: ...,
    seats: ..., workspaces: ..., analyticsDays: ..., apiPerMinute: ...,
  }).partial().optional(),                                 // null = unlimited; may lower (abuse containment) or raise
  features: z.object({ add: z.array(text), remove: z.array(text) }).partial().optional(),
  expiresAt: z.date().optional(),
  reason: text.max(1000), grantedBy: text, grantedAt: z.date(),
}).optional(),
```

Feature names are validated against `features` (`packages/billing/catalog.ts:6-16`) in the billing layer, since `@shortn/db` can't import `@shortn/billing`.

**Resolution** (`packages/billing/entitlements.ts:60-87`):
- `resolveEntitlements(subscriptions, now, override?)`.
- Effective plan = the higher of the best paid plan and `override.plan`, if the override hasn't expired.
- Limits = `plans[effectivePlan].limits` merged with `override.limits`.
- Features = plan features + `add` − `remove`.
- `Entitlements` gains `sources: {plan: "subscription" | "comp" | "free", overriddenLimits: (keyof PlanLimits)[], overrideExpiresAt?}` so the UIs can explain the result.
- `loadEntitlements(db, workspace: Pick<Workspace, "_id" | "entitlementOverride">)`. Every caller already has `ctx.workspace` (see `graft callers loadEntitlements`), so this is a mechanical, typed change. **No `as` casts.**

**Other subscription readers to update** (F9):
- `currentPlan` (`polar.ts:203-211`): the `workspaces.plan` snapshot should reflect the effective plan, so the facet in §2.2 is correct.
- `WorkspaceLayout` (`apps/web/src/app/[workspace]/layout.tsx:56-69`).
- `ssoWorkspaceAuthority` (`packages/auth/sso-authority.ts:216-230`): a comp to enterprise must satisfy SSO.
- `deleteWorkspace` (`members.ts:432-435`): a comp must not block deletion.
- `rest.ts:573-579` and `mcp.ts:116-122`: use `entitlements.limits.apiPerMinute` (F10).

**Platform feature flags** use the existing `workspaces.platformFeatures` tri-state (unset = rollout cohort; `features.ts:15-16`), exposed as default/on/off toggles on the workspace detail page. No schema change.

**Interaction with Polar and reconcile:**
- Reconcile only walks Polar subscriptions and never reads `entitlementOverride`, so it's unaffected and drift stays meaningful.
- If a comped workspace buys a plan, the effective plan is the higher of the two. The admin UI warns when comping at or below an active paid plan.
- Billing settings show "Complimentary Pro until 2027-01-01" from `sources`.
- Expiry is evaluated on read. A daily worker sweep unsets expired overrides (audited as actor `system`), and a reminder email goes out 7 days before.

**Usage when a limit drops below current usage:** existing documents are untouched; only creation is blocked (`countUsage` vs limit, `packages/core/usage/service.ts:49-51`).

**Audit:** `workspace.override.set` / `.clear` with before/after. **Reversibility:** full.

### 3.5 Cancel / refund subscription via Polar

**Semantics:**
- *Cancel at period end* uses the existing `setCancelAtPeriodEnd` (`packages/billing/polar.ts:346-355`).
- *Uncancel* is the same call with `false`.
- *Revoke now* (superadmin) is `polar.subscriptions.revoke`, ported from `old:lib/polar-admin.ts:96-108`.
- *Refund* (superadmin) is `polar.refunds.create({orderId, amount, reason, revokeBenefits: false, comment})` (`old:lib/polar-admin.ts:110-125`). New helpers go in `packages/billing/polar.ts`. Typed reasons replace the old cast at `old:lib/polar-admin.ts:120`.

**Data model:** none. The mirror is **never written directly**. After the Polar call succeeds, the action calls `applySubscription(db, polar, server, id)` (`polar.ts:126-134`) so the mirror converges immediately rather than waiting for the webhook. The webhook path (`apps/worker/src/billing.ts:91-140`) stays idempotent.

**Enforcement:** existing. Status changes flow into `paidStatuses` (`entitlements.ts:14`), so `past_due` keeps access through grace.

**User-facing:**
- Polar's own emails (the owner is disabling these).
- The rebuild's billing notices (`billing.ts:156-203` `canceled`) and refund mail (`@shortn/emails` `billingRefund`) fire from the event pipeline as for self-service actions, so customers get one consistent notice.

**Reversibility:** cancel yes; revoke and refund no. **Audit:** `subscription.cancel` / `uncancel` / `revoke` / `refund` with amounts. The admin needs `POLAR_ACCESS_TOKEN` with `subscriptions:write`, `refunds:write`, `orders:read` and `metrics:read` (§5).

### 3.6 Impersonate user

**Semantics:**
- A step-up admin picks the user, a target workspace and a mode. **Read-only** is the default; **write** is superadmin-only and needs a reason.
- The admin server inserts a `handoff_tokens` row (`{_id: sha256(token), userId, impersonatedBy: adminId, impersonationMode, expiresAt: +60 s, createdAt}`, the same shape legacy writes at `legacy/app/api/handoff/route.ts:49-55`). It opens `https://app.shortn.at/api/auth/handoff?t=<token>&next=/<slug>` in a new tab.
- The existing endpoint creates the 1 h session, skips 2FA, and the banner shows (F3).
- Banned or deletion-pending targets are refused (as `old:…/impersonate/route.ts:28-33`). Admins and superadmins can't be impersonated.

**Data model:**
- `handoff_tokens` gains optional `impersonationMode: "read" | "write"`.
- Sessions gain `impersonationMode` (additionalField next to `impersonatedBy`, `packages/auth/index.ts:386-397`).
- `handoff.ts:84-94` copies it into the session.

**Enforcement (closes F5):**
- `serviceContext` (`context.ts:10-19`) rejects mutations when `impersonatedBy` is set and the mode isn't `write`.
- A new `impersonationPolicy` plugin in `packages/auth` rejects `/change-password`, `/change-email`, `/set-password`, `/delete-user`, `/two-factor/*`, `/passkey/*`, `/sso/*`, `/oauth2/consent`, `/revoke-other-sessions` and `/api-key*` for any impersonated session, **regardless of mode**.
- `billing.ts` actions (checkout, portal, cancel) are always rejected for impersonated sessions.
- In write mode, every `serviceContext` mutation also appends an `admin_audit_log` row `impersonation.action`, with the action name, from the session's `impersonatedBy`.

**Reversibility:** the session ends on sign-out (banner button, `impersonation-banner.tsx:29-31`) or after 1 h. **Audit:** `user.impersonate` with mode, workspace and reason.

### 3.7 Resolve / dismiss report

**Data model:** `link_reports` gets a looseObject schema: `{linkId, workspaceId?, domain, urlCode, reason, details?, reporterIpHash, status: "open"|"reviewed"|"dismissed", createdAt, resolution?: {action: "takedown"|"no_action"|"restored", by, at, note?}}`.

**Semantics:** operations act on all open reports of a link at once (`updateMany {linkId, status: "open"}`).
- *Take down* runs §3.3 and sets `reviewed` with `takedown`.
- *Dismiss* sets `dismissed`; if the link was auto-blocked, it restores the link (§3.3).
- *Reviewed / no action* sets `reviewed` with `no_action`, and also sets `links.reportsReviewedAt` so later reports can be shown as "new since review".

**Enforcement:** none beyond §3.3. **Reversibility:** reports can be reopened. **Audit:** `report.resolve` with counts. **User-facing:** reporters are anonymous (IP hash only), so nobody is notified.

### 3.8 Domains: force re-verify, suspend, remove

- **Re-verify:** `$set: {nextAttemptAt: now}`, `$unset: {leaseUntil, lease}`. `pollDomains` (`packages/core/domains/service.ts:476-661`) picks it up within 60 s.
- **Suspend:** `status: "suspended"` (the enum value already exists and is unused), `suspension: {at, by, reason, previousStatus}`, `nextAttemptAt` unset.
  - Enforcement: `activeDomain` (`:662-682`) already requires `status: "active"`, so serving stops on the next request (no cache). `pollDomains`' status update guard (`:556`, `status: {$ne: "disabled"}`) must become `$nin: ["disabled", "suspended"]`, so a poll can't flip it back. `addDomain`'s collision checks (`:144,151,165`) already treat a non-`disabled` domain as taken, so a suspended abusive hostname can't be re-added elsewhere.
- **Remove:** call core `removeDomain` (`:278-356`) with a platform actor. It disables the domain, schedules Cloudflare removal through the poller, and invalidates the domain's link keys (`:354`).

**User-facing:** the Settings → Domains row shows "Suspended by Shortn" with the reason. There's a `domainSuspended` email.

**Reversibility:** re-verify and suspend yes; remove no (the owner can re-add the domain). **Audit:** `domain.reverify` / `suspend` / `unsuspend` / `remove`.

### 3.9 Webhooks: admin-disable, enable, cancel deliveries

- **Data model:** `webhook_endpoints.adminDisabled: {at, by, reason}`.
- **Disable** sets `enabled: false` and `adminDisabled`, then cancels pending and sending deliveries (`status: "cancelled"`, an existing status at `apps/worker/src/outgoing-webhooks.ts:64`).
- **Enforcement:**
  - `updateWebhook` (`packages/core/webhooks/service.ts:238-268`) returns `fail("admin_disabled")` when `enabled: true` is requested and `adminDisabled` is set. Today an owner re-enable unsets `disabledAt`/`failureSince` (`:259-261`).
  - `webhookView` (`:150-162`) exposes `adminDisabled`.
  - Delivery claim already requires `enabled: true` (`outgoing-webhooks.ts:53`).
- **Enable:** an admin unsets `adminDisabled`; the owner re-enables the endpoint themselves.
- **User-facing:** a settings banner, plus the existing `webhookDisabled` email variant with an admin reason.
- **Audit:** `webhook.disable` / `enable` / `deliveries.cancel`.

### 3.10 Role change (superadmin)

`role ∈ {user, admin, superadmin}`, set in a transaction that checks the remaining superadmin count. Self-change is refused. The target's `admin_sessions` are deleted. Promotion warns when the target has no TOTP, since they can't elevate (§1.4). There's no enforcement elsewhere: the admin guard re-reads the role on every request (§1.2). **Audit:** `user.role.update` with before/after.

### 3.11 Retry / cancel job

| Job | Retry | Cancel |
| --- | --- | --- |
| Link / analytics / workspace export, QR export, QR zip | `failed` → `pending`: `attempts: 0`, `nextAttemptAt: now`, unset error and lease. Outputs are keyed by job, so retrying is idempotent. | Existing `cancelLinkExport` (`packages/core/exports/jobs.ts:213`), `cancelWorkspaceExport` (`workspace-jobs.ts:151`), analytics and QR equivalents, via a platform-actor `ServiceContext` |
| Import | **Not offered.** Quota reservations and generations (`packages/core/imports/jobs.ts:15-60`) make blind retry unsafe; the owner re-uploads. | Existing `cancelImport` (`imports/jobs.ts:203-222`) |
| Webhook delivery | `failed` → `pending`, `nextAttemptAt: now`, `retryUntil: now + 24 h` | `cancelled` |
| Billing event | Unset `lockedUntil` and `error`, set `attempts: 0` (`apps/worker/src/billing.ts:73-86` claims it again) | Not offered |
| Bio delivery | Set `nextAttemptAt: now` | Not offered |
| Stuck lease (any) | Unset `leaseToken`/`leaseUntil`. Only offered when `leaseUntil < now - 5 min`. | — |

**Audit:** `job.retry` / `job.cancel`, with `targetType: "job"` and `metadata.kind`.

### 3.12 Contacts triage

`contacts.triage: {status: "new"|"open"|"replied"|"closed"|"spam", assignee?, note?, updatedAt, updatedBy}`. This is additive, and the contact writer (`contact/send/route.ts:67-82`) is unaffected. Audit only writes status changes (`contact.update`).

### 3.13 Delete user (GDPR erasure)

**Semantics** (superadmin, step-up, typed email):

1. **Preflight report** on the action page:
   - workspaces where the user is sole owner, split into personal and team-with-other-members (team workspaces must be transferred or explicitly included);
   - active paid subscriptions;
   - domains;
   - API keys;
   - data volumes (links, QR, bio, click events by workspace).
2. **Schedule.** Set `user.deletion = {requestedAt, by, purgeAfter: now + grace, state: "scheduled"}`. Revoke all sessions and credentials as for a ban (§3.1); the same hooks block sign-in. Optionally create a workspace export job (`kind: "workspace"`) per owned workspace through the existing export service. The export-ready mail checks `user.deletedAt`/`banned` (`workspace-export-notice.ts:76-81`), so it's sent **before** the deletion flag is set, or to an address the admin enters.
3. **Purge job** (new worker loop `account-purge`, leased like the other jobs), when `purgeAfter <= now`:
   1. revoke Polar subscriptions;
   2. soft-delete all links in the owned workspaces by setting `deletedAt` backdated past `linkTrashRetentionMs`, so the existing `purgeExpiredLinks` (`packages/core/links/service.ts:1375-1409`) removes them with the right cache invalidation. It needs the workspace to still exist (`:1388-1392`), so the workspace goes last;
   3. QR codes, bio pages (enqueue bio invalidation), campaigns, tags;
   4. domains (`removeDomain`);
   5. API keys, webhooks and their deliveries;
   6. import and export jobs and their stored objects (`@shortn/storage`);
   7. `click_events` by `m.workspaceId` (indexed `v2_workspace_time`), `click_rollups` and `workspace_daily` by `workspaceId`, `bio_views`;
   8. memberships elsewhere (`workspace_members`/`workspace_invites` by `userId`/email);
   9. better-auth rows (`session`, `account`, `twoFactor`, `passkey`, SSO bindings, OAuth consents and tokens, `verification`);
   10. `sign_in_events`, legacy `loginrecords` by `sub`.

   Kept: `link_reports` (abuse evidence, no personal data of the subject beyond the link), `admin_audit_log`, `billing_events` (TTL), and `contacts` matching the email (retention policy, Q5). Finally the user doc is replaced by a tombstone `{_id, deletedAt, emailHash: sha256(lowercase email), deletion.state: "done"}` so reports and audit links still resolve, and so re-signup abuse can be detected without keeping the email.
4. **Cancel** during grace clears `deletion` (audited). After purge, nothing can be reversed.

**Data model:** `user.deletion`, `user.deletedAt` (§3.1 schema). No migration. **Audit:** `user.delete.schedule` / `cancel` / `purge` (the last written by the worker as actor `system`, with counts per collection). **User-facing:** an `accountDeletionScheduled` email with the purge date, and a final confirmation after purge to the address captured at schedule time. That address is kept only in the outbox row until it's sent.

---

## 4. Phased implementation

Each step is one PR to `staging`. Enforcement (phase A) ships and is verified on staging before any admin UI can trigger it. Read pages (C) come before write buttons (D).

### Phase 0 — Hygiene (operator, no code)

- **0.1** Rotate the old console's secrets and delete its deployments (§5.3).
- **0.2** Freeze writes in the old console. It's archived only after phase D, but its ban, impersonate and usage-reset routes are ineffective or broken (F1, F4), so it should no longer be used for those.

### Phase A — Enforcement and data model (no admin app yet)

| Step | Scope | Acceptance and tests |
| --- | --- | --- |
| A1 | `packages/db`: schemas for `user`, `session`, `account`, `link_reports`, `admin_audit_log` (v2), `admin_sessions`, `admin_elevation_tokens`, `platform_daily`, `workspace_daily`, `worker_heartbeats`, `platform_notifications`, `sign_in_events`, `click_rejects`, `billing_reconcile_runs`; new fields (`suspension`, `entitlementOverride`, `moderation`, `adminDisabled`, `triage`); every non-`links` index from §2.12. `packages/auth`: declare `role`/`banned`/`banReason`/`banExpires`/`deletion` with `input: false`. | `bun run typecheck`; schema unit tests; `db:indexes --dry-run` on a staging copy lists only creations. Integration test: `update-user` with `{role: "admin"}` leaves `role` unchanged. |
| A2 | Ban enforcement (§3.1): `session.create.before`, `authenticateApiKey`, `authenticateMcpOAuth`, legacy hook, `sign_in_events`. | Integration: a banned user fails password, OAuth (mock provider), passkey and handoff sign-in with `ACCOUNT_SUSPENDED`; an expired ban succeeds; a banned creator's API key gets 401 on REST and MCP. Legacy test for its hook. **Risk:** a hook bug locks everyone out. Mitigation: the check matches only `banned === true`, deploy to staging first, and run a canary sign-in after deploy. |
| A3 | Workspace lock/suspend enforcement (§3.2) across web, API, MCP, worker, bio, `activeDomain`, `publicLink` and redirect (suspended set + channel), plus the legacy fallback read. | Integration per surface; a redirect unit test with the set; staging e2e: suspend via script → link shows the unavailable page within 1 s on every replica; bio 404 after outbox purge; API 403; dashboard screen; export still works. **Risky** (redirect hot path), see below. |
| A4 | Link moderation enforcement (§3.3): projection, `updateLink` guard, safety-page copy, dashboard banner, API field, webhook event. Core `takedownLink`/`restoreLink` in `packages/core/admin/links.ts` with explicit invalidation. | Integration: takedown on a **custom-domain** link → the redirect stops within L1 TTL (10 s); restore returns the exact previous state; owner edit returns `taken_down`; legacy route blocks. |
| A5 | Entitlement overrides (§3.4): `resolveEntitlements`/`loadEntitlements` signature, `sources`, `currentPlan`, layout, SSO authority, `deleteWorkspace`, API rate limits from `limits.apiPerMinute`. | Table-driven unit tests (subs × override × expiry); integration: a comped workspace passes the SSO authority and the API rate tier; reconcile output unchanged on a fixture with overrides. **Risk:** billing correctness. Mitigation: a pure function with exhaustive tests; ship behind an override that no workspace has yet. |
| A6 | Webhook `adminDisabled` stickiness; `pollDomains` `suspended` guard; job retry/cancel primitives in `packages/core/admin/jobs.ts`. | Integration per primitive. |
| A7 | Impersonation hardening (§3.6): `impersonationMode`, `impersonationPolicy` plugin, `serviceContext` read-only guard, billing guards. | Integration: an impersonated session can't change password or email, create an API key, open checkout, consent to OAuth, or mutate in read mode; write mode mutates and writes `impersonation.action`. |
| A8 | Admin elevation in apps/web/packages/auth: the `adminElevation` plugin, the `verifyTotpStepUp` refactor, the `/admin/elevate` page, the 2FA enrollment gate for admins (F16). | Integration: a non-admin gets 403; no TOTP gets refused; a replayed code is rejected (`lastTotpStep`); the token is single-use and expires after 60 s; an impersonated session is refused. |

### Phase B — Admin app shell

| Step | Scope | Acceptance |
| --- | --- | --- |
| B1 | Scaffold `apps/admin`: Next 16 (match `apps/web/package.json`), `adminEnv` in `packages/env`, Dockerfile modeled on `apps/web/Dockerfile`, `/api/health`. Admin session store, guard, callback, logout, step-up redirect, rate limits, CSP and headers, Origin checks, audit writer (`packages/core/admin/audit.ts`, write-ahead). | E2E on staging: login → callback → session; idle expiry; demoting the user kills the session on the next request; CSRF test (a foreign Origin POST gets 403); the audit row is written before the mutation, and a mutation is refused when the audit insert fails (fault injection). |
| B2 | `@shortn/ui`: `DataTable`, multi-series `TimeSeriesChart`, query-state and keyset helpers in `apps/admin/src/lib`. | Playground stories with 10k synthetic rows; keyboard navigation; narrow-screen reflow. |

### Phase C — Read pages

| Step | Scope | Acceptance |
| --- | --- | --- |
| C1 | Users list and detail | Every facet is index-backed; check with `explain()` in a test helper asserting no `COLLSCAN` on the facet queries, against a seeded 200k-user fixture. |
| C2 | Workspaces list and detail (without `workspace_daily` columns until C7) | Same `explain` guard; p95 render < 500 ms on staging data. |
| C3 | Links search (code/key/ID/workspace/custom domain) + `/links/[id]`; builds the three partial `links` indexes | **Risky index build** (below). `explain` guards. |
| C4 | Reports queue and auto-blocked tab | Grouping correct on a fixture with multi-report links. |
| C5 | Domains, Webhooks, Billing, Jobs (+ `worker_heartbeats` in the worker) | Heartbeat visible per loop; stuck detection on a fixture. |
| C6 | Contacts and Audit | Legacy `admin_audit_log` rows render (missing `status` shows as succeeded). |
| C7 | `platform-metrics` worker job (`platform_daily`, `workspace_daily`, backfill) and the Overview | Backfill is idempotent (re-running a day gives an identical doc); today's numbers match ad-hoc queries on staging; Overview loads ≤ 400 docs. |

### Phase D — Write actions (service already exists from A; each PR adds the action page and button)

D1 ban/unban/revoke sessions → D2 takedown/restore + report resolve/dismiss + bulk (≤1000) → D3 lock/suspend/unsuspend + `platform_notifications` outbox and the emails → D4 overrides, comps and platform features → D5 Polar cancel/uncancel/revoke/refund (sandbox first) → D6 impersonation → D7 role change → D8 domain, webhook and job actions → D9 contacts triage → D10 GDPR deletion (preflight, schedule, cancel, purge worker).

Acceptance for each: a Playwright run on staging of the action page (reason required, typed confirmation where specified, permission matrix enforced server-side by calling the action as `admin` when superadmin is required → 403), plus an audit row asserted. D10 also needs a full purge of a seeded user with data in every listed collection, and a check that nothing remains except the tombstone, reports and audit.

### Phase E — Destination-host search and bulk-by-host takedown

- **E1:** add `destHostRev`, the reversed lowercase hostname of `longUrl` (`login.evil.com` → `com.evil.login`), written by `createLink`/`updateLink`/import commit/legacy writer.
  - Migration `m0013-link-dest-host` (expand → verify → contract per plan 02) backfills in throttled batches; it's registered as `continuous` to catch legacy-written docs.
  - **Before the backfill**, extend the invalidator's ignore regex (`apps/worker/src/invalidator.ts:61-67`) to include `destHostRev`.
  - Then build `admin_dest_host`.
- **E2:** host search and "take down all links to host" (superadmin, ≤1000 per operation, chunked).
- **E3:** archive the old repo (§5.3).

### Risky steps and mitigations

| Risk | Where | Mitigation |
| --- | --- | --- |
| Redirect hot path regression | A3 (suspended set), A4 (projection) | The set check is O(1) after resolve, with no I/O. Boot load is a small partial-index query; if it fails at boot the service still starts but logs and retries every 5 s (fail open on suspension, never fail the redirect). Load-test the redirect on staging before and after. The edge falls back to legacy on 5xx (F8), and legacy has the A3 suspension read too. |
| Custom-domain cache staleness | A4, D2 | Explicit `invalidateLinks(link.domain)` in core (F7). Integration test on a custom-domain link. |
| Index builds on `links` | C3, E1 | Partial indexes; build off-peak with `db:indexes --yes` from the Forge host; watch primary CPU. On the single-node `rs0`, builds share the primary but don't block (hybrid builds). Dry-run first. `syncIndexes` aborts on name conflicts rather than replacing. |
| Large-collection backfill on `links` | E1 | Every update fires a change-stream event and writes a pre-image (`changeStreamPreAndPostImages` is on for `links`, `indexes.ts:554-566`). Without the ignore-regex change, each one becomes a Redis invalidation plus pub/sub publish. Throttle (≈500 docs per 2 s), run off-peak, and watch the oplog window. If change-stream history is lost, the invalidator flushes the **whole** link cache (`invalidator.ts:165-173`), causing a Mongo load spike. Ship the regex change in a separate PR first and verify it with `planInvalidation` unit tests. |
| Entitlement regression | A5 | Pure function, exhaustive tests, no data until D4. |
| Ban hook locking users out | A2 | Strict `=== true` predicate; staging canary; rollback by redeploying the previous web image. |
| Irreversible deletion | D10 | Superadmin + step-up + typed email; mandatory grace (Q5); preflight report stored in the audit row; the purge worker is idempotent and resumable (`deletion.state`), and dry-run mode is tested on a staging clone. |

---

## 5. Deployment

### 5.1 Forge targets and domains

- **Targets.** One Forge project per target (user convention):
  - `shortn-admin`: branch `master`, Dockerfile, `rootDirectory: apps/admin`.
  - `shortn-admin-staging`: branch `staging`, auto-deploy.

  Create them with no binding template, then `forge_resource_connect` the existing Mongo resource and set `MONGODB_URL=${database.mongodb.url}?directConnection=true` (`forge-infra-quirks`). **Production target creation needs the owner's OK.**
- **Domains.** `admin.shortn.at` and `admin-staging.shortn.at`. Use a **DNS-only CNAME to the target's own Forge hostname**, never another project's host and never proxied; since 2026-10-18 shortn.at is a CF-for-SaaS zone (`forge-infra-quirks`). Neither host is added to the edge Worker routes. Forge's Caddy adds `X-Frame-Options: SAMEORIGIN`, which is compatible with the CSP.
- **Build.** No environment-specific values in build output: the Forge build cache is shared across targets and ignores build secrets. So there are no `NEXT_PUBLIC_*`, env is parsed at runtime (`parseEnv` like `apps/web/src/server/env.ts`), and nothing env-dependent goes in `next.config` headers. CSP is built in `proxy.ts` at runtime. `COPY --chown=node:node` (Forge checkout modes). `EXPOSE 3000`.
- **Network exposure (Q2).** Public host plus the app-level MFA and elevation above. Tailnet-only serving is the stronger option and can come later.

### 5.2 Environment

| Var | Target | Notes |
| --- | --- | --- |
| `MONGODB_URL`, `MONGODB_PHYSICAL_NAMES` (if overridden) | admin | `directConnection=true` |
| `REDIS_CACHE_URL` | admin | rate limits, `invalidateLinks`, `workspace-suspension` publish (Forge-host Redis, reached as `forge-redis-<instance>:6379`) |
| `REDIS_DURABLE_URL` | admin | read-only use: `XLEN`/`XPENDING` and `bots:<day>`. Optional; the Jobs and Overview panels degrade without it. |
| `ADMIN_ORIGIN` | admin | `https://admin.shortn.at`; Origin checks, cookie scope |
| `APP_URL` | admin | `https://app.shortn.at`; elevation and impersonation handoff |
| `LINK_DOMAIN` | admin | invalidation of root-domain keys |
| `POLAR_ACCESS_TOKEN`, `POLAR_ENVIRONMENT` | admin | a **separate** organization token for the admin, scoped `subscriptions:write refunds:write orders:read customers:read metrics:read`, so it can be revoked independently of web/worker |
| `ADMIN_ORIGIN` | web | allow-list for the elevation callback URL (prevents an open redirect) |
| — | worker | none new (outbox reuses the mailer config) |

The admin needs **no** `BETTER_AUTH_SECRET`, SMTP credentials, Cloudflare token or `INTERNAL_API_SECRET`. Purges, mail and domain removal all go through worker outboxes.

### 5.3 Retiring `shortn-admin-console` and the env-print incident

What the old repo's history shows (all on 2026-08-12):

| Commit | Time | Change |
| --- | --- | --- |
| `c3585b0` | 18:00 | `app/api/route.ts` `GET` returned `{...process.env}` |
| `40d954b` | 18:09 | Removed that route; added `console.log(process.env)` to `app/login/page.tsx` |
| `b015470` | 18:11 | Moved the log into `lib/admin-guard.ts` |
| `4a0a08a` | 18:15 | Added `app/(dashboard)/env/page.tsx` rendering `JSON.stringify(process.env)` |
| `f930094` | 18:35 | Removed the page |

- All four were **deployed as Vercel Preview deployments** (GitHub deployment records: `…-rfbahg45v-…`, `…-r5an22sh7-…`, `…-cu3e8clqt-…`, `…-n25u4sxgu-…`). Those preview URLs now return `DEPLOYMENT_NOT_FOUND` (checked 2026-10-19).
- The `/api` route was gated only by `proxy.ts`, which checks that **a** `shortn_admin_` session cookie is present, not that it's valid (`old:proxy.ts:15-23`). Any request with a dummy cookie could read it, unless Vercel preview protection was on.
- The `console.log` variants wrote the whole environment to runtime logs.
- The branch `origin/chore/get-env-vars` still exists and still contains the env page.

Treat every variable in the old `.env` as exposed (`MONGODB_KEY`, `AUTH_SECRET`, `BETTER_AUTH_URL`, `INTERNAL_API_SECRET`, `MAIN_APP_URL`, `POLAR_ACCESS_TOKEN`, `POLAR_ENVIRONMENT`, plan IDs):

1. **Mongo:** rotate the password of the user in `MONGODB_KEY`. If it's the same user prod web/api/worker/legacy use, coordinate one rotation across all targets with `forge_env_set` and accept the container-recreate blip.
2. **Polar:** revoke that organization access token.
3. **`INTERNAL_API_SECRET`:** this is legacy's HMAC secret (`legacy/lib/impersonation-handoff.ts:19-23`) and web's `LEGACY_INTERNAL_SECRET` (`packages/env/index.ts:497-500`). Rotate both together.
4. **`AUTH_SECRET`:** if it equals legacy's `BETTER_AUTH_SECRET`, rotate it. That invalidates legacy sessions, which is acceptable now that legacy only serves fallthrough.
5. Delete `origin/chore/get-env-vars` and every remaining Vercel deployment and project for the old console, after checking whether production is still live. Check the Vercel log drains/retention for the 2026-08-12 window.
6. After phase D: archive the GitHub repo (it's private) and drop its Vercel project.
7. The `admin_audit_log` history stays in place and is read by the new console.

---

## 6. Open questions for the owner

**Resolved 2026-10-19** (owner):

| # | Decision |
| --- | --- |
| Q1 | Elevation from app.shortn.at with TOTP step-up and an admin-only session store (§1.1 C). |
| Q2 | Public `admin.shortn.at` for now. |
| Q3 | Local `entitlementOverride` on the workspace, honoured by `loadEntitlements` **and** the readers that bypass it (`packages/billing/polar.ts`, `packages/auth/sso-authority.ts`, `packages/core/workspaces/members.ts`). |
| Q4 | Two levels: *lock* (read-only dashboard and API, links keep redirecting) and *suspend* (delivery stops, visitors see the unavailable page). |
| Q5 | 7-day grace; matching `contacts` retained 12 months. Deletion itself ships in D10. |
| Q6 | Catalog numbers. REST and MCP read `entitlements.limits.apiPerMinute`, so overrides apply. |

The original questions and recommendations follow for the record.

1. **Admin sign-in model.** Elevation from app.shortn.at with TOTP step-up and an admin-local session store (§1.1 C), or a separate better-auth login as in the old console?
   *Recommendation:* C. It reuses hardened sign-in, needs one MFA enrollment, and keeps admin sessions out of the user session list. Option A can't reuse TOTP or passkeys without sharing the app secret, and it risks the shared `twoFactorEnabled` flag.
2. **Network exposure.** Public `admin.shortn.at` behind app-level MFA, or tailnet-only?
   *Recommendation:* public now (Forge's Caddy and Cloudflare tunnel are host-based, and DNS-only records rule out Cloudflare Access on this zone). Revisit tailnet-only if more staff are added.
3. **Plan comps.** Local `entitlementOverride` (§3.4), or Polar-native $0 products?
   *Recommendation:* local. It covers limit overrides too, avoids $0 receipts and extra products, and leaves reconcile untouched.
4. **Suspension levels.** Two levels, *lock* (read-only, links keep serving) and *suspend* (everything off), or only *suspend*?
   *Recommendation:* both. Billing and ownership disputes shouldn't break printed QR codes; only abuse should stop delivery.
5. **GDPR deletion policy.** How long is the grace for admin-initiated erasure, and how long are matching `contacts` and evidence kept?
   *Recommendation:* 7-day grace (cancellable). Delete click events with the workspace. Keep `link_reports` and `admin_audit_log` with a hashed email. Keep `contacts` 12 months, then purge.
6. **API rate tiers.** Which numbers are right: the hard-coded REST/MCP table (plus 180, pro 600/min) or the catalog (plus 300, pro 1200/min)? Overrides will read the catalog.
   *Recommendation:* the catalog values, since they're what plans advertise. Change the code in A5.

---

## 7. Phase A implementation notes

Where the code departs from the text above, and why.

- **A1.** `admin_banned` and `admin_2fa` lead with the flag (`{banned:1,_id:-1}`): Mongo rejects a partial filter on a bare `{_id:-1}` key. `admin_suspended` leads with `suspension.level` so the redirect's set load is index-backed. `deletion` is declared in better-auth with `returned: false` as well as `input: false`, so `get-session` doesn't hand the user the staff id in `deletion.by`. `sign_in_events` also stores `impersonatedBy`, so the login history can tell impersonation apart.
- **A2.** The ban predicate lives in `@shortn/db` (`accountSuspension`, `findAccountSuspension`) so the rebuild, legacy and the API/MCP authenticators share one definition. The handoff checks it before the 2FA branch and redirects to `/login?error=ACCOUNT_SUSPENDED`; the session hook remains the backstop. A password sign-in that still awaits TOTP isn't recorded in `sign_in_events` (the two-factor plugin deletes that session). Passkey sign-in is refused, but the UI shows the generic passkey failure: two `@better-auth/core` copies are installed, so the passkey plugin's `instanceof APIError` misses ours and rewrites it to `AUTHENTICATION_FAILED`. That masking predates this work (it also hides `USER_VERIFICATION_REQUIRED`).
- **A3.** Lock and suspension are enforced through the actor, not `serviceContext`: `workspaceContext` (every dashboard request) and the API key / MCP OAuth authenticators set `actor.readOnly`, and `can()` then allows only `workspace.view` and `billing.manage`. Read pages keep working for locked workspaces, every core mutation (all gated by `can()`) is refused, and edit controls that ask `can()` disappear. Exports don't go through `can()` and stay available. `serviceContext` needed no change. The suspended screen and banner are client components keyed on the pathname, because the workspace layout doesn't re-render on client navigation. Webhook deliveries of a suspended workspace are held (back to `pending` in 5 minutes, attempt not counted) until `retryUntil`. The redirect's suspended set covers links with a `workspaceId`; legacy links still waiting for continuous M2 to assign one aren't covered until it runs. `setWorkspaceSuspension` in `packages/core/admin/workspaces.ts` is the mutation only (permission and write-ahead audit are B1/D3); `apps/worker/scripts/workspace-suspension.ts` drives it for staging checks and records an audit row as actor `script`.
