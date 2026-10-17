# Exports

The local backend supports incremental CSV/JSON encoding, the shared Links view
filters, Mongo snapshot cursors and durable private-object-store jobs. Private dashboard HTTP delivery and in-page review, progress and history are implemented locally. Analytics job encoding, workers and private HTTP delivery are also implemented locally; the analytics dashboard is connected locally; full-workspace archive jobs/private HTTP and ready-email outbox are implemented locally, with their dashboard and email sign-in return connected locally; this document does not claim complete P6 export coverage.

`EXPORTS_ENABLED` defaults to `0` in web, API and worker schemas. Enabled startup
requires `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
`S3_SECRET_ACCESS_KEY`; production uses HTTPS. Deploy the `export_jobs` indexes
and private 24-hour object lifecycle before enabling. The worker pumps bounded
pages of due jobs into BullMQ and closes its own queue clients on shutdown.

Core validates filter shapes and reads current membership and plan entitlement.
`csvExport` gates CSV and JSON; a campaign-scoped export also requires
`campaignExport`. Workspace/legacy ownership, hidden and QR exclusions, trash,
search, tags, campaign, status and date behavior come from the same filter helper
as Links browsing. The exported fields are destination URL, key, title, tag
names, domain, expiry, created time and click total. Password hashes, safety
internals, user identifiers and signing keys are never export columns.

For fewer than 5,000 rows, `prepareLinkExport` returns a **server-only** selection
of at most 4,999 IDs. Pass it to `streamFilteredLinkExport`; never send the
selection to the browser or use a client-side library fetch. The bounded IDs
prevent concurrent inserts/filter changes growing the instant response past the
threshold. A Mongo snapshot cursor streams batches of 500, preserving a stable
view through concurrent updates. Authorization and plan reads run outside that
snapshot on each batch; abort closes the cursor/session.

At 5,000 rows or more, preparation creates a 24-hour export job. A request UUID
deduplicates retries for the same workspace/creator/format/filter; changing the
request under that UUID conflicts. The worker streams a complete CSV or JSON
file to private storage with a one-GiB transport bound, renews the fenced lease,
updates processed-row counts and retries transient transport failures. Recovery
restarts encoding into a fresh attempt object. No partial object is signed.
Only an unexpired completed job's own `exports/jobs/links/{workspace}/{job}/`
object can be delivered. Results expire from job creation, and signed delivery
never extends the remaining lifetime. Cancellation or a replaced lease prevents
the obsolete worker from publishing. Creators and current workspace admins/owners
may inspect jobs; membership/plan access is checked again at delivery.

CSV declares `shortn_format=shortn-csv-v1`. Formula-looking values are protected
with an apostrophe and literal apostrophes doubled; the importer reverses this
only for declared Shortn rows. Tags use JSON arrays within CSV cells so embedded
commas/semicolons remain lossless. The URL remains complete rather than splitting
UTM parameters, preserving duplicate parameters and fragments. Ordinary CSV
input keeps its previous behavior. Existing import file/row/field limits apply
to exported files being imported again.

Local integration evidence lives in `apps/worker/src/imports.integration.test.ts`:
actual worker round trip into a new workspace, 4,999/5,000 boundary, frozen instant
selection, snapshot consistency, abort/current membership and plan checks,
private signing/expiry, retry and idempotency, cancellation, stale-lease recovery,
and a real BullMQ queue. Parser/format tests cover formula safety and reversible
tags/quotes/apostrophes. All services in those tests are synthetic/loopback. Real
bucket CORS/signing/multipart/lifecycle and staging acceptance remain separate gates.

## Private dashboard HTTP delivery

These routes use the dashboard session cookie, not public API keys. All responses
are private/no-store with Cookie variance and nosniff. The independent web export
flag and current membership/plan access gate every operation.

| Route | Behavior |
| --- | --- |
| `POST /api/link-exports/{workspace}` | Metadata-only preparation; returns 201 with a download URL for <5,000 selected rows or 202 with safe job metadata and a status URL for larger views. |
| `GET /api/link-exports/{workspace}/download/{ref}` | Authenticated attachment stream for the creator-bound frozen selection; no browser library payload. |
| `GET /api/link-exports/{workspace}/jobs/{id}` | Authenticated safe progress/terminal metadata, with private signed delivery only for a valid completed job. |
| `POST /api/link-exports/{workspace}/jobs/{id}` | `{ "action": "cancel" }`; repeated cancellation is idempotent, and completed/failed jobs return 409. |

Preparation accepts JSON `{ format: "csv" | "json", filter?: { ... }, requestId?:
UUID }`. Filter names match core search/tags/campaign/status/createdAfter/
createdBefore/trash/sort; dates accept ISO date-time strings. JSON bodies are
bounded to 32 KiB even without Content-Length. Unknown fields/operators,
malformed JSON and inappropriate content types fail before preparation.
Preparation/cancellation require an exact Origin matching the configured dashboard
origin; missing or foreign origins return 403. Authentication returns 401, missing
workspaces/tokens/jobs 404, absent export entitlement 403, idempotency conflicts
409, oversized metadata 413 and wrong content type 415.

Instant selections remain in durable Redis under a workspace/creator/ref key for
15 minutes. Responses contain only a ref URL, format, count and expiry; the
4,999-or-fewer IDs and complete filter never reach the browser. Downloads validate
the current session, token lifetime, membership and export entitlement again.
The pull-based response preserves backpressure and closes/aborts the cursor on
request abort or response cancellation. Attachments use fixed safe filenames.
HEAD requests perform the same access/token checks without opening a data cursor.
These private endpoints do not extend the public REST contract listed in spec 10.

`apps/web/e2e/link-exports-http.local.ts` runs against the loopback P6 sandbox and
owns a synthetic private object store and real BullMQ worker. It verifies an actual
4,999-row Chromium attachment, reversible CSV bytes, concurrent insertion without
selection growth, a 5,000-row queued JSON artifact, private response headers,
origin/body-shape boundaries, a valid foreign workspace, creator-bound token expiry,
request deduplication, cancellation/retry/completed-state behavior and current plan
revocation. Evidence is saved in `.impeccable/review/p6-link-export-http/evidence.json`.
Transport unit tests verify body bounds, exact origin matching, pull backpressure,
request abort and iterator cleanup. No external provider writes are involved.


## Dashboard review, progress and history

The Links header opens `/{workspace}/links/export` with the current search, tags,
status, created-date, trash and sort scope. Pagination and row selection do not
narrow this whole-filter export. The review shows the total and 25 rows per page,
grouped by creation date, using the Links controls and divided list styling.
Tag suggestions are capped at 50 and search on the server; selected names remain
available when suggestions change. The main Links page uses the same bounded
suggestions. No complete link library is fetched into the browser.

Choose CSV or JSON and prepare the export once. Small exports show a download
link valid for 15 minutes. Background exports open a status page with processed
counts, cancellation and private download on completion. Polling pauses while
the page is hidden and preserves retryable failures; invalid access removes any
signed download. History shows unexpired background jobs, 25 per page, with
status and format filters. Members/viewers see their own jobs; current workspace
admins/owners can inspect workspace jobs. Expired jobs and plan/access loss have
in-page recovery actions. The pages are translated into English, Portuguese and
Spanish and use the existing light/dark themes.

`apps/web/e2e/link-exports-ui.local.ts` verifies a synthetic 5,000-link/103-tag
library, filter preservation, whole-filter 27-row CSV/JSON downloads across two
review pages, duplicate-submit prevention, remote tag search outside the first
50 suggestions, empty state, cancellation, actual BullMQ worker delivery,
30-job history pagination/filtering, expiry, plan loss and 390px bounds. Captures
and assertions are in `.impeccable/review/p6-link-export-ui/evidence.json`.
This is local dashboard evidence; analytics/workspace exports and external
storage/staging acceptance remain open.


## Analytics export jobs

Analytics exports always use durable jobs: aggregate CSV, or raw CSV/NDJSON.
`POST /api/analytics-exports/{workspace}` accepts only metadata:

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "query": {
    "mode": "raw",
    "format": "ndjson",
    "scope": { "type": "workspace" },
    "from": "2026-10-01T00:00:00Z",
    "to": "2026-10-15T00:00:00Z",
    "timezone": "UTC",
    "interval": "day",
    "filters": {},
    "dimensions": []
  }
}
```

The response is 202 with safe job metadata and an API `statusUrl`.
`GET /api/analytics-exports/{workspace}/jobs/{id}` reads progress and completed
private delivery. POST to that job with `{ "action": "cancel" }` cancels a
pending/running job; cancellation retries succeed, while completed/failed jobs
return 409. GET the collection path for 25-row history, with `page`, `state`,
`format` and `mode` filters. These private dashboard routes use session cookies,
exact Origin checks on mutations, a 32 KiB metadata body bound and the same
private/no-store headers and current creator/admin visibility as link exports.
They are not public bearer-authenticated REST operations.

Owned link, QR, tag and campaign scopes and filter semantics share analytics
resolution. `csvExport` gates either format and `campaignExport` additionally
gates campaign scope. Preparation clamps the lower bound to the plan window and
the upper bound to request time. That effective window is retained during a plan
upgrade; current membership, scope and entitlement are rechecked outside the
snapshot during batches, worker heartbeats and delivery. A downgrade that narrows
the prepared window fails closed. Window age is anchored at request time, so
ordinary elapsed execution time does not continuously move the export's start.

Raw rows explicitly contain timestamp, event kind, key, country, city, continent,
device, browser, OS, referrer, language, branch and five UTM values. Event/tenant/
actor IDs, IP hashes, raw IP and user agents are excluded. NDJSON preserves the
original values; CSV protects spreadsheet formula prefixes. Raw cursors use
500-row batches. All sections of one aggregate file and raw traversal share a
Mongo snapshot session, including on the native time-series collection. Cursors
and sessions close on completion, failure and abort.

Aggregate CSV columns are `section,dimension,value,period,clicks,scans,uniques`.
It contains a total, populated time buckets in the requested timezone/interval,
and every group for each requested plan-allowed dimension. It does not inherit
the dashboard's top-row cap. Empty ranges include a zero total. Two-stage grouping
counts distinct visitors without building one unbounded visitor array; Mongo may
spill grouping to disk. Visitor hashes never appear in the file.

Analytics jobs use a separate kind and queue in the export collection; link
workers and endpoints explicitly exclude that kind. Due/history indexes include
kind. The fenced, renewable worker writes a unique attempt object below
`exports/jobs/analytics/{workspace}/{job}/`, with the existing one-GiB transport
bound, five transient retries and 24-hour lifecycle. Only a completed current
attempt is signed, for at most its remaining lifetime; cancellation or a replaced
lease prevents stale publication. Worker startup/pump/shutdown use the existing
independent `EXPORTS_ENABLED` flag, which remains off by default.

`apps/worker/src/analytics-exports.integration.test.ts` verifies native time-series
snapshot consistency, more than 1,000 aggregate groups, bounded raw traversal,
DTO redaction/formula safety, retention/plan changes, retries, cancellation,
replaced/expired leases, current roles, kind/tenant isolation, expiry, pagination
and a real BullMQ pump. `apps/web/e2e/analytics-exports-http.local.ts` verifies the
actual authenticated Next routes and 1,005-row private downloads in all three
mode/format combinations. Its synthetic evidence is in
`.impeccable/review/p6-analytics-export-backend/http-evidence.json`.
The analytics dashboard and breakdown pages now open in-page job review rather
than fetching an entire CSV response into browser memory. Full-workspace export, real storage/staging acceptance and
other P6 deliverables remain open.


## Analytics dashboard

Analytics and full-breakdown Export actions open `/{workspace}/analytics/export`,
preserving browser-local dates/timezone, interval, owned campaign scope, link/kind
and event filters. A breakdown entry retains that requested dimension. The page
shows the effective retained window, a current all-matching event count and
readable scope/filter values. It submits that bounded window, so a plan upgrade
before preparation cannot widen the reviewed range. The form offers aggregate
CSV and raw CSV/NDJSON; aggregate groups are disclosed only in aggregate mode.
Raw exports with no matching events are disabled; a valid empty aggregate view
can still export zero totals. Dates wholly outside retention have no prepare
action until the user changes the view.

Preparation opens in-page progress with written-row counts and indeterminate
activity, cancellation and a completed private download. Polling pauses while
hidden, uses one request at a time and removes delivery links on expired or lost
access. History filters mode/state/format on the server with 25-row pages.
The UI uses the shared Page, native selectors, divided rows, FilterBar and
Pagination with English, Portuguese and Spanish in both themes. It introduces
no library picker or complete browser library/event fetch. The older private
`/api/export/{workspace}` endpoint remains present for compatibility, but the
dashboard no longer calls it.

`apps/web/e2e/analytics-exports-ui.local.ts` exercises synthetic 5,000-link/101-tag
libraries with 1,005 matching events, all three mode/format downloads through a
real worker, breakdown entry, scope preservation, duplicate submits, cancellation,
30-job history pagination/filtering, empty/expired/plan states and 1440/390px
layouts. Evidence is in `.impeccable/review/p6-analytics-export-ui/evidence.json`.


## Full-workspace archive jobs

`POST /api/workspace-exports/{workspace}` accepts only an optional request UUID,
for example `{ "requestId": "00000000-0000-4000-8000-000000000001" }`.
It returns 202 safe job metadata and an API status URL. GET the collection for
25-row history (`page`, `state`); GET `jobs/{id}` for status and completed private
delivery; POST `jobs/{id}` with `{ "action": "cancel" }` to cancel. The routes use
session cookies, exact mutation Origin checks, a 32 KiB metadata limit and
private/no-store headers. Completed/failed cancellation returns 409, cancellation
retries succeed, unknown/expired jobs return 404 and current-role refusal is 403.
These are private dashboard routes rather than public REST API operations.

Authorization requires both the current workspace owner ID and a current owner
membership; a stale session role is insufficient. This portability export has no
paid `csvExport` or analytics-window gate. A workspace may have **one active
archive**; a different request while it is pending/running returns 409
`export_in_progress`. A partial unique index enforces that limit across requests.
Accepted UUID retries return the original job. Expired active rows release the
slot before eventual TTL deletion. Install the new active/mail indexes before
enabling the worker. The one-GiB transport bound applies to the complete ZIP;
size failure never exposes a partial download.

The ZIP contains 18 fixed-name entries:

- `workspace.json` and versioned `manifest.json` with record counts.
- JSON and CSV for links, QR codes, bio pages, retained bio-page versions,
  campaigns, tags and domains.
- `analytics.json` and `analytics.csv`, containing aggregate totals, populated
  daily UTC buckets and every dimension over all stored canonical workspace
  events. No visitor hash or raw event payload is exported.

Native and legacy personal-workspace ownership follow the same core predicates
as browsing. Hidden, QR-backing and trashed links are included. Link JSON retains
rules, social preview, UTM and reference metadata; link CSV uses the existing
reversible `shortn-csv-v1` format. QR JSON/CSV preserves stored design options,
including legacy gradients. Bio exports retain normalized draft/published content,
versions and complete owned legacy link/configuration data, so editor migration
limits do not truncate the archive. Foreign link references are omitted.
Complex CSV cells contain JSON and spreadsheet formula prefixes are protected.
Images remain referenced by URL; binary images/QR render files are not bundled.
Auth/session records, password hashes, signing credentials, provider verification
secrets and raw visitor data are excluded through explicit DTOs/projections.

A single Mongo snapshot covers workspace metadata and every resource/aggregate
file. Cursors use 500-row batches and close with their session on EOF, failure or
abort. ZIP output drains after each source chunk, preserving storage backpressure
instead of accumulating a library/archive in memory. Current ownership is checked
outside the snapshot between batches and on the renewable fenced worker lease.
Cancellation, ownership loss, replaced leases and expiry prevent publication.
Retries use a fresh attempt object under
`exports/jobs/workspace/{workspace}/{job}/`; results and signatures never outlive
the job's 24 hours from request. Startup/pump/shutdown use `EXPORTS_ENABLED`, still
off by default, with the existing private S3 configuration and job lifecycle.

Ready email has a separate leased outbox in the job. Storage completion remains
available if mail fails; transport retries do not regenerate the ZIP. Sending
requires the requester to remain the current owner and have a current verified
auth-account email. Revoked ownership suppresses delivery. Localized en/pt/es
HTML/text uses the shared mail layout and a stable provider idempotency key.
The email points to an authenticated workspace export page, so forwarding an email
does not give a download capability. Current-owner access and expiry are checked
again before signing the file. Configure `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM`
and the intended `MAIL_ALLOWLIST`; absent/unavailable mail transport leaves a
retryable pending notification. The ready link opens the authenticated job page;
signing in preserves the exact validated workspace-export destination. Incoming
headers cannot supply an alternate return path.

`apps/worker/src/workspace-exports.integration.test.ts` verifies a 5,001-link ZIP,
a 2,501-link legacy bio, all content categories, one cross-file snapshot during
writes, secret/tenant isolation, all stored aggregates on a free plan, owner
changes, concurrent active requests/expiry, running cancellation, retries and
stale leases, separate mail retry/idempotency and a real BullMQ pump.
`apps/web/e2e/workspace-exports-http.local.ts` verifies actual session HTTP and an
18-entry private S3 ZIP, metadata bounds, free-owner access, current-role refusal,
kind/tenant isolation, UUIDs, cancellation/history/expiry. Evidence is in
`.impeccable/review/p6-workspace-export-backend/http-evidence.json`.

### Workspace dashboard

The current owner sees Export workspace in General settings. The in-page review
at `/{workspace}/settings/workspace/export` explains archive scope, exclusions,
the 1 GiB limit, one-active-job limit and 24-hour expiry. A live job replaces
Prepare with Continue export. Submission uses a stable request UUID and a local
duplicate guard; no library rows are fetched into the browser.

`/{workspace}/settings/workspace/exports/{id}` shows truthful phase/row progress,
cancellation, expiry, private ZIP download and separate pending/sent/failed email
state. Polling pauses in hidden tabs and continues at a lower frequency for a
completed archive whose email is pending. A completed download remains available
while email retries; expired or unauthorized reads remove it. Manual actions
invalidate stale poll responses. History at `.../exports` uses shared filters,
divided list rows and server-side 25-row pagination.

`apps/web/e2e/workspace-exports-ui.local.ts` verifies an isolated free workspace
with 5,001 links, 100 tags and 2,501 legacy bio references, real BullMQ/private
synthetic S3 generation and download of all 18 ZIP entries, duplicate submission,
active-job continuation, cancellation, history pages/state filtering, retry,
owner loss and expiry. A fake notifier verifies pending-to-sent polling and the
signed-out email → sign-in → exact job → ZIP flow without real provider mail.
Desktop/mobile en/pt/es light/dark evidence and design review live in
`.impeccable/review/p6-workspace-export-ui/`. Helper tests reject external,
traversing and malformed return paths. Real email/R2/staging acceptance and
remaining P6 requirements stay open.
