# Outgoing webhooks

Outgoing webhooks are implemented behind default-off flags. Main link CRUD,
trash/restore, managed bio publication and domain verification produce automatic
events. Campaign UTM changes and QR backing/attachment mutations also produce link
events. Tag rename/deletion, domain assignment/removal/recovery, safety scans and
report-triggered blocking also emit link updates. Opted-in clicks and scans are
batched. Import completion remains pending.
Explicit test requests produce `webhook.test` deliveries.

## Configure an endpoint

Use an API key with `webhooks:write` whose creator is a workspace owner or admin.
Creation, changes, tests and redelivery require `PLATFORM_WEBHOOKS_ENABLED=1`, a
configured `WEBHOOK_SECRET_KEY`, and an enabled workspace or rollout cohort.
Metadata reads require `webhooks:read` and an owner/admin creator. Reads and
removal remain available when outgoing provisioning is disabled.

`POST /v1/webhooks` accepts `name`, an HTTPS `url`, `events`, and optional
`enabled` (default true). Supported subscription names are `link.created`,
`link.updated`, `link.deleted`, `link.clicked`, `qr.scanned`, `bio.published`,
`domain.verified` and `import.completed`.

The creation response includes a `whsec_…` signing secret. Retain it securely;
subsequent metadata reads omit it. Replaying the original POST with the same
`Idempotency-Key` returns the original creation response. Signing secrets are
encrypted in MongoDB and creation-response idempotency records. Keep the same
encryption key across API and worker processes. Changing it requires a separate
re-encryption procedure; replacing it directly prevents existing secrets from
being decrypted.

Endpoints must use HTTPS without URL credentials or fragments. The delivery
worker rejects private, loopback, link-local, reserved and other special IP
ranges, including mixed public/private DNS answers. It pins a validated DNS
address while preserving TLS hostname verification, applies DNS and request
deadlines, and treats redirects as unsuccessful deliveries.

## Test, inspect and redeliver

`POST /v1/webhooks/{id}/test` returns HTTP 202 with the persisted delivery ID and
event ID. No destination request runs in the API handler. The worker sends:

```json
{
  "id": "event UUID",
  "type": "webhook.test",
  "createdAt": "2026-10-13T12:00:00.000Z",
  "workspaceId": "workspace ID",
  "data": {}
}
```

`GET /v1/webhooks/{id}/deliveries` returns a cursor-paginated log retained for 30
days. It includes status, attempt count, timestamps and bounded error codes,
without receiver response bodies or signing secrets. Use
`POST /v1/webhooks/{id}/deliveries/{deliveryId}/redeliver` to create a new delivery
for the same event. An expired log record cannot be redelivered.

Endpoint metadata uses `GET /v1/webhooks`, `GET/PATCH/DELETE /v1/webhooks/{id}`.
Lists accept `cursor`, `limit` (1–200, default 50) and literal `search` on name or
URL. Disabling or deleting an endpoint prevents queued deliveries from starting
another destination request; an already-started request may finish.

## Verify deliveries

Headers include `Shortn-Delivery-Id`, `Shortn-Event-Id` and
`Shortn-Signature: t={unix seconds},v1={hex HMAC-SHA256}`. The signed bytes are the
timestamp, a period, and the exact raw UTF-8 request body. Use the complete
`whsec_…` string as the HMAC key, without decoding or removing its prefix. Check
timestamp freshness and compare signatures with a constant-time comparison.

Delivery is at least once. Persist the event ID when processing an event so an
uncertain network response or manual redelivery cannot repeat an already-applied
operation. All attempts for a delivery retain its delivery and event IDs;
manual redelivery has a new delivery ID and the original event ID. Return a 2xx
status once the event has been durably accepted by the receiver.

MongoDB is the durable delivery source. BullMQ executes attempts on the durable
Redis instance. Failed attempts back off exponentially from one second, capped
at one hour, within a 24-hour retry window. Expired leases can be reclaimed after
a worker interruption. Endpoints with an unresolved failure period of three days
are disabled and a notification record is persisted atomically. When email is
configured, the worker emails the workspace owner in their preferred language,
retrying failed sends every five minutes with a stable provider idempotency key.
Each new disablement has a separate notification identity. The existing mail
allowlist applies. Workspace owners and admins can manage endpoints and delivery logs in Settings → Webhooks.

## Automatic mutation events

The mutation and source event commit together in a MongoDB transaction. Failed
mutations produce no event. No enabled subscriber means no source event is stored.
The worker fans out in bounded recipient pages, advancing its cursor atomically
with delivery creation. Concurrent pumps and restarts reuse automatic delivery
identities. Subscribers created after the event are excluded; subscriptions and
workspace feature gates are checked when fanout runs and before sending.

Main link creation emits `link.created`; edits and restoring a trashed link emit
`link.updated`; moving an active link to trash emits `link.deleted`. Repeating
delete/restore does not emit another transition event. Link `data` contains `id`,
`domain`, `key`, `url`, `title` and `deletedAt`, with no password material, safety
reports or visitor information. Managed publication emits `bio.published` with
`id`, `handle` and `revision`; republishing that revision is a no-op. A domain's
transition to active emits `domain.verified` with `id`, `hostname`, `kind` and
`status`; periodic verification does not repeat the event.

## Click and scan batches

Explicitly subscribe to `link.clicked` or `qr.scanned` to receive these events.
They are collected separately per workspace and event type, then sent when 100
receipts accumulate or the oldest receipt reaches 10 seconds. The worker checks
every second; queue or database backlog can delay delivery. One pump processes
at most 20 batches of 100 receipts, sharing capacity between due workspaces.

Batch `data` has `count` and an `events` array. Each entry has `id` (the original
stream ID), `linkId`, `timestamp`, `domain`, `key` and, for scans, `qrId`. Domain
and key strings are bounded. Raw IPs, user agents, referrers, query parameters
and visitor hashes are excluded. Bots are excluded. Legacy personal-workspace
links and legacy QR backing links are supported; QR ownership and backing-link
identity are checked before recording a scan.

Receipts commit with majority write concern before Redis acknowledgement. If
receipt persistence fails after analytics was saved, the pending entry replays
without duplicating analytics or webhook receipts. Receipt consumption and source
event creation share a transaction, so an interrupted batch can be retried.
Completed receipts retain their stream IDs for 30 days to deduplicate replays;
unprocessed receipts have no TTL. Automatic fanout uses the batch's first receipt
time to exclude endpoints created after collection started. Workspace and endpoint
disablement still apply when the batch is flushed and delivered.

Campaign UTM replacement, rename and deletion emit `link.updated` for links whose
variants change. Their events commit with campaign membership and canonical link
fields. References are workspace scoped, including legacy title-only references;
other campaign IDs with the same title are preserved. Repeating identical variants
emits no update. Stale expected-state edits return a conflict before creating a
campaign or recording an event.

Creating a QR emits `link.created` for its hidden backing link and `link.updated`
when attaching it to an existing link. QR editing emits updates for changed
backing/attached links, including tags when explicitly applied to the attachment.
Deleting a QR emits `link.deleted` for its removed backing link and `link.updated`
for detachment. QR, backing-link, attachment and source-event mutations share a
transaction; creation quota checks are serialized, and deletion archives legacy
scans in 1,000-row pages inside that transaction. Stored link IDs keep attachment
updates and detachment working after a linked resource is renamed. Legacy records
without those IDs retain their key-based lookup.

Tag rename and deletion emit `link.updated` for linked resources, including
trashed links and canonical tag-ID references. Repeating the current tag name is
a no-op. Tag/reference updates and source events share the existing transaction.
Workspace ownership checks exclude contaminated foreign references.

Domain assignment, removal and recovery emit updates for changed links. Assignment
checks hostname/TLS readiness and add-on status in its transaction, protects all
previous keys against collisions, and rejects trashed links. Domain operations
invalidate canonical and alias caches on affected hosts and queue related bio
page invalidations with the mutation. Recovery retains conflicting links on their
original host.

Safety scans emit updates when risk, status or blocking fields change. Periodic
rescans with identical state emit no event. A scan result for a changed destination
is discarded; fields derive from the current transactional document, preserving
concurrent password edits and report-triggered blocking. The third distinct abuse
report blocks the link and emits an update in the same transaction. Reports below
the threshold and duplicate reporters do not emit update events. Report details,
reporter identities and visitor data are excluded from event payloads.

## Workspace settings

Settings → Webhooks provides in-page create/edit forms, explicit event selection,
pause/enable controls, test requests and confirmed deletion. The signing secret
is shown once after creation; copy it and acknowledge saving it before creating
another endpoint. Refreshing or leaving the page removes the secret from the UI.
Endpoint lists support literal name/URL search and 25-row cursor pages.

Open an endpoint's Delivery log to view its 30-day history in 25-row pages.
Rows show event identity, state, attempts, HTTP status and bounded error codes.
Redeliver creates a new delivery for the same event, and Refresh updates the log.
Paused endpoints must be enabled before requesting deliveries. When outgoing
webhooks are unavailable, reads and deletion remain available; provisioning and
delivery requests are disabled. Server actions recheck the current workspace role
and shared service gates for every operation. Interface copy is available in
English, Portuguese and Spanish.
