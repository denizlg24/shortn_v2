# Shortn admin console

The console continues the toolkit at `38f6b94`. It uses the existing elevation-only login, shared UI tokens and in-page action forms. Staff roles, fresh elevation, reasons, confirmation text and write-ahead auditing are enforced on the server.

## Implemented surfaces

- Overview: bounded daily rollups, real time series, list-price MRR with custom pricing excluded.
- Users: indexed facets, profile, memberships, sessions, sign-in history, connected accounts, passkeys, contacts and audit; ban/unban, session revocation, role changes, impersonation and erasure.
- Workspaces: paginated list, membership/invite, billing, domain, key, webhook, link, audit and export views; effective entitlement usage; lock/suspend/restore, comps, limits and platform flags.
- Links: exact IDs, short URLs/keys, workspace slug/ID, tag search, safety, moderation and destination host filters. Selection persists across pages and filters. Confirmation freezes IDs for ten minutes, previews 50 at a time and enforces 100 links for admins or 1,000 for superadmins. Host-wide operations require superadmin and fresh elevation.
- Reports: grouped by link with counts, distinct reasons, first/last report and keyset paging; individual decisions and automatic-block review.
- Domains, webhooks, jobs, contacts and audit: paginated operational views and audited actions. Queue summaries and heartbeats refresh every 30 seconds. The audit viewer accepts historical rows without a status.
- Billing: subscriptions, webhook events, reconcile runs, historical differences and comps. Cancel, uncancel, revoke and refund use Polar and refresh the mirror. Refunds verify the order's subscription and refundable amount; a repeated form cannot issue a second refund after an uncertain network response.

## Worker integration

`platform-metrics` refreshes today and yesterday and fills one missing historical day per tick, up to 400 days. Billing history starts when the worker is deployed; source TTLs limit historical coverage. `entitlement-overrides` expires grants and queues reminders. `platform-notifications` leases mail outbox rows, uses idempotency keys and removes recipient addresses after sending.

Account erasure has a seven-day grace period, typed email confirmation, a recorded preflight and cancellation before purge begins. Shared team workspaces must be transferred first. The purge worker leases one account, waits for domain removals, bio invalidations and active job leases, deletes stored objects and namespace-scoped uploads, and removes workspace data before the workspace itself. Retries retain progress. The final user document is a hash tombstone; reports and audit remain, and matching contacts receive a twelve-month retention deadline. No storage or Polar configuration means a purge that needs that service stops and retries rather than silently leaving data behind.

## Local verification

Use only disposable local services and a database beginning `shortn_admin_`. Start the console on port 3005 with `MONGODB_URL`, `MONGODB_DB`, `REDIS_CACHE_URL`, `ADMIN_ORIGIN=http://localhost:3005` and the app's local `APP_URL`.

```sh
bun run --cwd apps/admin build
bun run lint
bun apps/admin/scripts/smoke-auth.ts
bun apps/admin/scripts/smoke-console.ts
```

The browser script requires Google Chrome (or `CHROME_PATH`), seeds 200,000 users and 10,000 links, checks indexed facets, visits all primary routes, submits ban/unban, follows keyset pagination and captures desktop/mobile layouts under `/tmp/shortn-admin-finish-review`. It deliberately keeps its disposable fixture database for inspection. Credentials, tokens and screenshots are not committed.

The integration suite uses `MONGO_TEST_URL` and `REDIS_TEST_URL` and creates and drops its own databases:

```sh
bun test packages/core/admin apps/worker/src/admin-rebuild.integration.test.ts apps/worker/src/invalidator.test.ts packages/db/index.test.ts packages/db/destination-host.test.ts packages/storage/index.test.ts packages/emails/emails.test.tsx
```

## Rollout order

1. Deploy the invalidator's `destHostRev` ignore change before any host backfill. It is isolated in its own commit.
2. Build and deploy the console and worker on staging. Apply non-link indexes with the existing index CLI in dry-run mode first. Apply the partial moderation/host indexes off-peak; they still scan the links collection while building.
3. Run migration `0013-link-dest-host` with bounded batches and a delay (500 documents / 2 seconds is the plan's starting point). Verify it, then let continuous migrations catch legacy writes. Host searches are complete only after this migration has passed verification.
4. Run the auth/browser checks against staging, validate queue heartbeats and exercise Polar actions in the sandbox. Verify p95 timings against staging data. A local mock or development render is not a substitute for those checks.
5. Enable production administration only after the enforcement changes from phase A and the required indexes are deployed. Keep worker storage, Polar and mail configuration in place for purges.

Deployment, production index builds/backfills, old-console secret rotation and old-repository retirement are operator steps and are not performed by the implementation scripts. Review the existing plan's phase 0 and deployment sections before retiring the old service.

## Verification notes

The console production build, local auth smoke test, large-library browser run and the targeted integration suite pass. Repository-wide lint passes with existing legacy warnings. The repository-wide typecheck encounters pre-existing `node:dgram` Socket event typing errors in the auth SSO test helpers; the same errors reproduce at the unchanged toolkit commit. Changed packages are checked separately.

Visual review used the incumbent Geist typography, navy semantic tokens, hairline rows, shared table/filter toolkit and in-page forms. Desktop (1440 px) and mobile (390 px) captures show no document overflow. The mechanical design detector returned no findings. Review was performed in the main thread as requested; no implementation agents were launched.
