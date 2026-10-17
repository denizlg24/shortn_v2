# CSV imports

The link and QR import backend and dashboard are implemented locally and disabled by default. A local filtered-CSV round trip through the actual import worker is verified; the in-page filtered export UI is also implemented locally; external acceptance remains open. There are no public import REST routes yet.

## Worker configuration

Set `IMPORTS_ENABLED=1` on the web app and worker only after provisioning private storage and
job indexes. Enabled startup requires `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`; production storage must use HTTPS.
Run `bun run db:indexes` and use the existing durable Redis configuration. The
worker discovers bounded pages of Mongo-backed jobs into BullMQ and recovers
expired leases after a restart. The flag defaults to `0`.

Input objects under `imports/{workspaceId}/{importId}.csv` must remain private.
Presigned PUT grants expire in 15 minutes and sign the exact length, CSV type,
private cache control and conditional no-overwrite header. The provider must
accept these headers through browser CORS. The real bucket's signing, conditional
PUT and lifecycle behavior still needs staging acceptance. Error CSV output under
`exports/jobs/imports/` requires a 24-hour lifecycle and private signed delivery.

## Pipeline

Core creates an actor/workspace-bound link or QR upload job with a 24-hour lifetime. Inspection
reads at most 10 MiB in the worker, parses at most 50,000 rows and snapshots source
rows in 500-row transactions. A SHA-256 source hash prevents mixed snapshots after
an upload changes during recovery. Poll views contain column names, row count and
only the first 20 rows, with preview cells bounded to 200 characters.

Mapping supports destination (`url`, `destination`, `long_url`), key (`key`, `slug`,
`code`), title, tags, UTM fields, expiry and domain. Ambiguous headers need an
explicit choice. A mapping change creates a new result generation; it cannot
change an import that is already committing.

Dry runs validate every row through the same URL, key, reserved-name, domain and
plan-feature checks as ordinary link creation. They detect duplicate custom keys
within the file, retain row-specific failures and stream a formula-safe error CSV.
No links, tags or quota reservations are created by a dry run. The ready summary
shows valid/error counts by code and advisory quota availability; commit rechecks
capacity before writing.

Commit reserves link or QR capacity for the whole valid set before any imported resource is
created. A refusal reports exact used, reserved, requested and available numbers.
Other v2 creates and imports respect this hold. Commits create at most 500 rows per
transaction through the shared creation pipeline. Link/tag writes, safety metadata,
mutation events, capacity consumption, row identities, receipt and job checkpoint
commit together. QR imports also insert the QR document and hidden backing link
in that transaction, with the standard default design. They charge QR quota and
preserve mapped keys, custom domains, destination/UTM, title, tags and expiry.
Retried chunks return stable resource IDs without duplicating either document.

Each committed receipt is invalidated again and warmed through the redirect
service's shared loader and generation-aware Redis cache, with at most 16 parallel
loads. A separate warming checkpoint resumes work after a post-commit cache
failure. Cache fills retain their normal fail-open behavior during outages;
required invalidation errors remain retryable. QR scan
identity is resolved by backing-link ID and legacy public-ID fallback, so identical
keys on different domains cannot select another QR's scan identity.

Lease checks occur inside the chunk transaction. Cancellation releases only
remaining capacity; an obsolete lease cannot write more rows. The worker checks
the creator's current membership and creation permission during every stage and
before each chunk. Terminal infrastructure failures release remaining holds.
Committed rows remain counted as usage. A commit whose rows are all created
finishes its completion event rather than accepting a late cancellation.

`import.completed` and the completed job state share a transaction. A failed
outbox write retries completion without recreating links. Only import identifiers
and counts enter the completion payload. Status and error delivery recheck current
workspace access, and signatures cannot outlive the job.

## Legacy coexistence

Deploy the updated legacy application and v2 writer code before enabling imports
while both applications accept creates. They share a stable legacy-identity lock
and the workspace mutation lock, including a legacy create that begins before a
personal workspace is provisioned. The legacy adapter uses its own Mongoose
connection/session; it does not mix BSON values or sessions from another driver.

Accepting an import sets an internal workspace marker that makes document-based
v2 quota authoritative for subsequent legacy link and QR creates. This continues
after the hold is consumed, released or expires, so legacy meter lag cannot admit
writes beyond the period limit. Legacy plan checks remain in place; accounts that
have never accepted an import retain their earlier behavior. Held capacity stays
separate for links and QRs, and refusals preserve the existing `plan-limit` result
with exact quota details.

The two legacy writes that create a QR/backing pair now share the quota transaction.
A failed QR write cannot leave an orphan backing link. Title/tag reads, password
hashing, cache invalidation and usage delivery stay outside the transaction.

## Verification and remaining gates

Local tests use real Mongo transactions, cache Redis and durable BullMQ with
synthetic private storage. They cover dry runs/errors, mapping generations,
whole-import quota refusal, cancellation, permission loss, changed input and
completion-event retries. A child worker is killed after 500 of 1,001 rows commit;
a replacement completes the job with exactly 1,001 rows and three receipts. The
same process-kill test covers QR imports and verifies 1,001 complete QR/backing
pairs, unique link references and QR-only usage. Rollback tests reject a QR insert
after backing rows are staged and verify that rows, tags, receipt, capacity and
checkpoint all roll back. Custom-domain tests cover view/design/export data,
cached scan identity, edit/delete and a same-key record on another domain.

A complete 50,000-link local run (inspection, dry run and commit) finished in
38.6 seconds with cache warming and synthetic private storage. This does not satisfy
the required staging acceptance. Real bucket CORS/conditional PUT/lifecycle and staging rollout remain
open. The full P6 goal is still active.

## Dashboard

Links and QR library headers open `/{workspace}/imports/new?kind=links|qr`.
The in-page form uploads CSV bytes directly to a private signed PUT; server
actions accept only byte count and resource kind. Pasted URLs are converted to
the same CSV format in the browser. Upload progress, cancellation and errors stay
in the form. Signing failures remove the unused upload job, and upload-completion
retries reuse the existing job.

`/{workspace}/imports/{id}` provides column mapping, the bounded 20-row preview,
full dry-run review, private error CSV download, exact quota numbers, explicit
creation of all valid rows, cancellation and background progress. After a dry
run, mapping and source preview are expandable so row results remain easy to
reach. Polling only runs during active phases while the tab is visible. An expiry
refresh removes the job and signed attachment after its lifetime.

History at `/{workspace}/imports` and row results both paginate on the server at
25 per page. Members/viewers see their own jobs; owners/admins may inspect other
workspace jobs. Only the creator with current create permission can upload,
remap or commit. Cancellation uses current resource-delete permission. Every
server action authenticates workspace access again. Row filters support literal
keyword search, server-searched tags, valid/invalid state, specific errors and
grouping by error. Tag suggestions are capped at 50; row labels and source column
names are bounded. Storage keys, worker leases, source cells and full result
sets are excluded from dashboard responses.

The web flag defaults to `0`, independently of `QR_EXPORTS_ENABLED`. Enabled web
startup requires all five private S3 settings and HTTPS in production. Deploy the
new indexes before enabling. English, Portuguese and Spanish use the existing
Page, FilterBar, list and Pagination controls; all flows are in-page.

Run the synthetic local browser harness against the P6 sandbox:

```sh
bun --no-env-file apps/web/e2e/imports.local.ts
```

It owns loopback private storage and a real BullMQ import worker, checks actual
conditional browser PUT headers, CSV and pasted URL input, mapping-error recovery,
dry runs without creation, error CSV download, row/history pagination, tags,
quota refusal, cancellation, and successful link/QR creation. Captures and
assertion evidence live in `.impeccable/review/p6-import-ui/`. A separate Mongo
integration check verifies bounded 25-row responses for a 50,000-row result set,
actor/workspace isolation, expiry, literal searches, tag caps and upload retries.
These checks do not establish real-provider or staging acceptance.

## Shortn export round trips

Shortn CSV exports declare `shortn_format=shortn-csv-v1` on every row. Values that
could become spreadsheet formulas receive a leading apostrophe; literal leading
apostrophes are doubled. The importer removes that protection only for declared
Shortn rows. Tags in this format are a JSON array inside the quoted CSV cell,
so commas, semicolons, quotes, Unicode and apostrophes inside tag names survive.
Unknown/blank declared versions and malformed tag arrays are rejected. Ordinary
third-party CSV keeps its existing delimiter-based tags and literal values.

Destinations retain their complete query and fragment, including repeated UTM
parameters; export does not split/rewrite them into separate UTM columns. A local
integration test exports a filtered source workspace, frees its global key, and
imports the CSV into a different workspace through inspection, dry run and commit.
It verifies destination, available key, tags, title, UTM and expiry. Existing
10 MiB/50,000-row import limits still apply to exported files being re-imported.
