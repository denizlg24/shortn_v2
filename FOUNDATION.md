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

## Forge legacy deploy changes

Keep Git operations and dependency installation at the repository root.
Build and start the app from `legacy/`:

```sh
cd "$FORGE_SITE_PATH"
git pull origin "$FORGE_SITE_BRANCH"
bun install --frozen-lockfile
cd "$FORGE_SITE_PATH/legacy"
bun run build
# Keep the existing daemon restart and health-check commands here.
```

Update the legacy daemon's working directory to `$FORGE_SITE_PATH/legacy`;
keep its `bun run start` command and current port. If the daemon uses an
absolute Next CLI path, use `$FORGE_SITE_PATH/legacy/node_modules/next/dist/bin/next`
and set its working directory to `legacy/`. Next itself should run on Node 24.

Provision dotenv files in `legacy/` (Next now reads them there). If Envoy
continues restoring the app env file to the repository root, create a
`legacy/.env` symlink to `../.env`, or configure Envoy's tracked file path to
`legacy/.env`; use the corresponding filename for `.env.local` or
`.env.production`. Keep `.envoy/` management and Husky at the repository root.
Any nginx aliases or artifact paths targeting `public/` or `.next/` must add
`legacy/`. Proxy host, port and public URLs stay as configured. The legacy
script must build legacy only; do not add database operator commands to it.

The staging deploy and route/login/dashboard smoke checks require Forge
access and are outside this local foundation change.
