# Foundation operations

Run `bun install --frozen-lockfile` at the repository root. `bun run lint`,
`bun run typecheck`, `bun run test`, and `bun run build` run through Turborepo.
The new packages export TypeScript source directly for Bun; they do not emit
build artifacts. Legacy retains its original app scripts and dependencies.
Its added `typecheck` task generates Next route declarations before running
the existing `type-check` task. Root `jose` pins legacy's previously implicit
transitive import to the existing lockfile version.

Generate the shared template with `bun run env:example`. Applications must
call `parseEnv` with their own schema at startup; schemas are not parsed on
package import. The template contains placeholders, never actual secrets.
`AUTH_SECRET` remains required for the redirect's legacy cookie verification
until the M9 coexistence window ends.

## Local integration tests

```sh
docker compose -f docker-compose.test.yml up -d
# Wait for mongo-init to finish successfully (exit status 0).
docker compose -f docker-compose.test.yml wait mongo-init
MONGO_TEST_URL='mongodb://127.0.0.1:27017/?replicaSet=rs0' \
REDIS_TEST_URL='redis://127.0.0.1:6380' \
REDIS_DURABLE_TEST_URL='redis://127.0.0.1:6379' bun test packages/db packages/redis
docker compose -f docker-compose.test.yml down -v
```

The replica-set member advertises `127.0.0.1:27017` for host-side tests. Use
these containers only for fixtures. Tests create random databases beginning
`shortn_foundation_test_` and delete only those databases. Redis tests use
random keys and clean them up. Integration suites skip with explanatory
messages when test URLs are unset; set both Redis test URLs to test isolation.
GitHub Actions starts Mongo explicitly because Actions service definitions
cannot pass `mongod --replSet` command arguments, and uses two Redis services.
The legacy build job also supplies an empty Mongo fixture at its original dummy
hostname `dependabot`, because bio-page `generateStaticParams` queries Mongo
during builds. Its internal API dummy secret is padded to meet the legacy
schema's existing 32-character minimum.

## Database operations

Set `MONGODB_URL` and `MONGODB_DB` explicitly for operator commands. Nothing
connects during import, typechecking or normal unit tests.

```sh
bun run db:indexes --dry-run
bun run db:indexes
bun run db:migrate --dry-run
bun run db:migrate --verify-only
bun run db:migrate --until 0003-link-domain-key
```

The index command compares keys and index options, only creates missing
indexes, reports conflicting definitions for manual review, and prints drop
suggestions without executing them. It enables pre/post images on existing
legacy-written collections and creates `click_events` as time-series with
one-day buckets and no TTL. Existing collection names remain `urlv3s`,
`qrcodesv2` and `biopages` until P7. Every new unique index on a collection
legacy writes is partial. This command does not backfill data or resolve
conflicting keys; expansion indexes require the prerequisite data audit.

Production migration registration is intentionally empty in
`packages/db/migrations/cli.ts`. The example migration is a test fixture only.
Future migrations use context `read`, `batch`, and `archive` methods. Batch
sizes default to 1,000; `--batch-size` accepts 1–5,000 and
`--batch-delay-ms` limits the write rate. Source `_id`s must be ObjectIds.
Each batch writes data and its checkpoint in the same replica-set transaction.
`batch.target` supports copying from a source collection into another; use a
stable `checkpointId` for each separate pass over the same collection.
Migrations must use idempotent operations because a failed batch is replayed.
Rejected unordered batches fail promptly and retain the checkpoint for resume;
this prevents a masked permanent write error from triggering repeated
transaction retries.
The lease is renewed and fenced in every batch transaction. A lost lease
refuses writes; expired leases can be reclaimed. `continuous` migrations
reset checkpoints after successful runs to catch new legacy documents.
Scheduling those sweeps and implementing change-stream synchronization belong
to the worker phase.

`--down` runs rollback functions in reverse order through the same checkpoint
mechanism. Verify receives the operation direction. `--verify-only` writes
nothing. Dry-run emits planned counts and sample operations and verifies the
unchanged database; unmet up postconditions are expected in that mode.
Migration code must use the context API for all writes and must not create
external service side effects in a dry-run.

Contract migrations require `--confirm-contract`, even for planning. Each
contract batch also requires `ctx.archive(collection)` first; it copies docs
into `archive_<collection>_<migrationId>` and verifies source coverage before
allowing destructive batches. P7 backup/retirement gates remain operator
requirements. The runner does not invent approval or backup evidence.

## Forge deploy (Docker per app)

Every deployable app ships its own `Dockerfile`; the build context is always the repository root and the Forge target points at the app directory.

| Target                                                  | rootDirectory   | framework    | Dockerfile                 | health      |
| ------------------------------------------------------- | --------------- | ------------ | -------------------------- | ----------- |
| legacy app (`shortn`, `shortn-staging`)                 | `legacy`        | `dockerfile` | `legacy/Dockerfile`        | `/api`      |
| redirect (`shortn-redirect`, `shortn-redirect-staging`) | `apps/redirect` | `dockerfile` | `apps/redirect/Dockerfile` | `/__health` |
| worker (`shortn-worker`, `shortn-worker-staging`)       | `apps/worker`   | `dockerfile` | `apps/worker/Dockerfile`   | `/__health` |
| future: web / api                                       | `apps/<name>`   | `dockerfile` | `apps/<name>/Dockerfile`   | per app     |

- Build-time env reaches the build through Forge's `forge-env` build secret (the legacy build validates env and reads bio pages from Mongo for `generateStaticParams`).
- The image runs Next's standalone server (`node legacy/server.js`, port 3000) on `node:24-trixie-slim`; `canvas` needs glibc.
- Switching the production target from `nextjs` to `dockerfile` + `rootDirectory: legacy` happens when this structure is promoted to `master`.

## Redirects, clicks and data expansion (P2/P3)

Migrations `0001`–`0012` live in `packages/db/migrations/registry.ts`. Order of
operations for an environment: `bun run db:indexes`, then
`bun run db:migrate --dry-run`, then `bun run db:migrate`, then
`bun run --cwd apps/worker rollups:rebuild` once. The worker repeats every
continuous migration whose state is `applied`, every minute; a reverted or
failed one stays off until an operator runs it again (delete its
`_migrations` document to re-enable a reverted continuous migration).

Migration-time env: `IP_HASH_SECRET` (0007; must equal the worker's),
`POLAR_ACCESS_TOKEN` + `POLAR_ENVIRONMENT` (0011, read-only),
`S3_*` + `NEXT_PUBLIC_APP_URL` (0012). `0007` has no automatic rollback:
delete `click_events` with `legacyId` manually if it ever has to be undone.

`apps/redirect` needs `MONGODB_URL`, `MONGODB_DB`, both Redis URLs,
`AUTH_SECRET` (legacy's, for confirmation tokens and password cookies) and
`PUBLIC_ORIGIN`. `EDGE_AUTH_SECRET`, when set, must match the edge Worker's
secret and makes the service reject requests without it. `apps/worker` needs
the Mongo and Redis variables plus `IP_HASH_SECRET`.

Parity gate (14 P2), against a database both apps read:

```sh
MONGODB_URL=… MONGODB_DB=… bun run --cwd apps/redirect parity <legacy-origin> <redirect-origin>
```

Forge hostnames are Cloudflare-for-SaaS custom hostnames of `denizlg24.com`, so
Worker routes for `shortn.at` hosts attach to that zone; a route on the
`shortn.at` zone never runs (verified on staging 2026-10-10). The edge Worker
(`apps/edge`) deploys with `bunx wrangler deploy [--env staging]`
and `wrangler secret put EDGE_AUTH_SECRET`. Set the route's request-limit
failure mode to fail open in the Cloudflare dashboard. `CANARY_PERCENT=0` is the
rollback.
