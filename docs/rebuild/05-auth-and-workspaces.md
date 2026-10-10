# 05 — Auth & Workspaces

## Auth (better-auth, kept)

- `packages/auth` holds the single better-auth config, shared by `apps/web` (session UI) and `apps/api` (session or API-key auth). It uses the shared Mongo client from `packages/db`, which fixes the double-client topology problem from #412.
- Kept: email+password, Google, GitHub, the username plugin, email verification, account linking, session geo fields, admin impersonation (nonce/backref collections). Impersonation sessions are visibly bannered in the new UI.
- Added: **organization plugin** (workspaces), **SSO plugin** (SAML/OIDC, Enterprise only, 06), **two-factor** (TOTP + backup codes), **passkeys**, rate limiting backed by Redis secondary storage, and session caching in Redis (`secondaryStorage`). Sessions are looked up per request today; this takes the load off Mongo.
- Cookies: prefix `shortn_auth_` kept, **host-only on `app.shortn.at`**. Bio subdomains and custom domains never receive auth cookies.
- Migrating sessions to the new host: the dashboard moves from `shortn.at/{locale}/dashboard` to `app.shortn.at`. Cookies don't cross hosts, so to avoid logging everyone out, legacy `/dashboard*` routes 302 to `app.shortn.at/handoff?t=…`. The token is a one-time, 60 s token minted by legacy from the existing session and stored in Redis. The new app exchanges it for a session. The impersonation handoff code already implements this pattern and gets reused. Users without a session just land on the login page.
- `proxy.ts` logic (locale + auth redirects) is replaced by: a Next 16 `proxy` that only does locale negotiation on marketing routes, and dashboard auth gating in the layout via `auth.api.getSession` with React `cache()`. Today's "logged-in users get redirected from marketing to the dashboard" rule goes away: marketing lives on the root host and the app on `app.`, so that redirect would only be a nuisance.

## Workspaces

### Model

- A workspace owns links, QR codes, bio pages, campaigns, tags, domains, API keys, webhooks, usage and **the subscription**.
- Every user has exactly one **personal workspace** (created by M2 for existing users and at signup for new ones). Paid plans can create more workspaces, and team workspaces are a paid feature.
- Roles:

| Capability                                    | owner | admin | member | viewer |
| --------------------------------------------- | ----- | ----- | ------ | ------ |
| View links, analytics                         | ✓     | ✓     | ✓      | ✓      |
| Create/edit links, QR, bio, campaigns         | ✓     | ✓     | ✓      | —      |
| Delete others' resources                      | ✓     | ✓     | —      | —      |
| Domains, API keys, webhooks                   | ✓     | ✓     | —      | —      |
| Members & invites                             | ✓     | ✓     | —      | —      |
| Billing, delete workspace, transfer ownership | ✓     | —     | —      | —      |

- Authorization lives in `packages/core/authz.ts` as one `can(actor, action, resource)` function, used by server actions, REST and MCP alike. Actors are a user+membership, or an API key with scopes (10). Every repository query takes a `workspaceId` that comes from the authorized context, never from client input.

### Seats & limits

- Seats are an entitlement (06): personal plans get 1 seat; team plans include N seats and sell extra seats as an add-on.
- Invitations are emailed with role pre-assigned (localized react-email). Pending invites count toward seats.

### Workspace switching & URLs

- Dashboard URLs are `app.shortn.at/{workspaceSlug}/links`, `…/analytics`, etc. The slug is in the path, not a cookie, so tabs on different workspaces don't fight.
- The last-used workspace is stored per user and used for `app.shortn.at/` → redirect.

## Migration of ownership (`sub` → `workspaceId`)

Handled by 02 §M2. Code rules during transition:

- New code reads and writes `workspaceId` only.
- The continuous M2 job assigns `workspaceId` to anything legacy creates (legacy writes `sub`) within ~1 minute. The new dashboard also tolerates a missing `workspaceId` by resolving `sub → personal workspace` on read for the gap window.
- `sub` is kept on documents until contract C2, and kept forever in `workspaces.legacySub`.

## Account lifecycle

- Account deletion: soft-delete with a 30-day grace period (restorable), then hard delete via a job. The job cancels the Polar subscription, deletes owned workspaces that have no other owners (with a transfer prompt if they have members), and anonymizes events (`m.workspaceId` kept, the link is gone, so they're excluded). Today's deletion path should be audited in P0. If it currently deletes clicks inline, that stays as-is for legacy.
- Data export (GDPR Art. 20): a one-click full-workspace export job (links, QR, bio, campaigns, analytics aggregates) → R2 signed URL.

## Acceptance

- Existing users log in on `app.shortn.at` with their existing credentials and OAuth accounts. The handoff carries a logged-in legacy user over without a re-login.
- An owner invites a member, the member creates a link, and the owner sees it. A viewer can't mutate anything via UI, REST or MCP (authz test matrix).
