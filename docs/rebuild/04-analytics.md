# 04 — Analytics Pipeline

Goal: every non-bot click and scan is recorded exactly once, dashboards load in < 300 ms for any range, and analytics are GDPR-clean by construction.

## Ingestion

```
apps/redirect ──XADD──► Redis Stream `clicks:stream`
                              │  consumer group `ingest` (apps/worker, N consumers)
                              ▼
               batch (≤500 msgs or 250 ms) → enrich → write → XACK
                 ├─ click_events.insertMany (ordered:false)
                 ├─ legacy `clicks` insert (src:"v2") + $inc clicks.total/$max lastClick on the
                 │   legacy link or QR doc (P2–P4 only, so the legacy dashboard keeps moving)
                 ├─ Redis HINCRBY rollup:{linkId}:{day} … (hot counters)
                 └─ usage counters (06): INCR usage:{ws}:{period}:clicks
```

- **At-least-once, deduped on redelivery.** This is not "exactly once": time-series collections can't take writes inside a transaction, so event insert, id record and counters aren't atomic. Every event stores its stream ID (`sid`). Fresh deliveries insert directly. **Redelivered** messages (delivery count > 1, or claimed via `XAUTOCLAIM` after 60 s) check `click_events` for `sid` before inserting. Counters are repaired by the nightly rollup recompute (below), so a duplicate counter increment self-heals within a day.
- **Enrichment in the worker, off the hot path:** UA parse (ua-parser-js), referrer → `refDomain`, UTM extraction from the query, IP → `ipHash` (HMAC, secret rotated yearly, key ID stored) and `ipPrefix`. The raw IP is dropped after hashing.
- **Counter flush:** every 30 s the worker flushes the Redis hot counters into `click_rollups` (`$inc`, upsert by `{linkId, day}`) and `links.stats` (`$inc clicks|scans`, `$max lastClickAt`). This replaces the per-click `save()` and its lost updates.
- **Trimming:** `XADD` never uses `MAXLEN`. On Redis 7, `MAXLEN` trims regardless of the consumer group's state and would silently drop unprocessed clicks during a Mongo outage. Instead the worker periodically runs `XTRIM clicks:stream MINID <id>`, where `id` is the minimum of the group's last-delivered ID and the oldest pending entry (`XINFO GROUPS` / `XPENDING`). (Redis ≥ 8.2 ack-aware trimming can replace this later.)
- **Backpressure:** the durable Redis instance runs `noeviction` (13). Alerts fire on stream length > 100k, consumer lag > 60 s, and memory > 70%. An outage grows the stream; it never drops events.
- **Redis persistence:** AOF `everysec` + RDB snapshots. The maximum window at risk on a hard crash is ~1 s of clicks, which is accepted. Until they're written to Mongo, clicks exist **only** in the stream (or the redirect's spool file, 03). They aren't reconstructible from Mongo.
- **Nightly repair:** recompute `click_rollups` and `links.stats` for closed days from `click_events`.

## Storage

- `click_events`: Mongo **time-series** (`timeField: ts`, `metaField: m`, granularity minutes). Time-series compresses heavily (expect ~5–10× smaller than the current `clicks`), and time-bucketed range scans are what analytics do.
- `click_rollups`: one doc per link per day with breakdown maps. All dashboard charts read rollups, except:
  - the "last 24 h / live" view reads `click_events` directly (small range),
  - drill-downs needing combinations (e.g. country × device) read `click_events` with an aggregation, bounded to ≤ 90 days, with results cached in Redis for 5 min.
- Workspace-level rollups (`click_rollups_ws` per workspace per day) are derived from link rollups in the same flush and power the home dashboard.

## Retention & privacy

- Events contain no raw IP and no full UA string (only parsed fields + `uaHash`). The data is pseudonymous at most.
- **Raw IPs are kept for 90 days (decided)** in `click_ips { sid, ip, ts }`, a regular collection with a TTL index of 90 days, for abuse and fraud investigation only. It's not used in any dashboard, and access is admin-only and audited.
- Default retention is unlimited for events and rollups. A per-plan _query window_ exists (e.g. free: 30 days visible; data is kept, so an upgrade reveals history). That's honest and drives upgrades.
- Legacy `clicks` (with raw IPs) are archived, never mutated. The retention/anonymization decision is in 02 C4.
- The privacy page and DPA are updated to describe this pipeline (13).

## Queries & API

`packages/core/analytics` exposes one query function used by the dashboard, REST API and MCP:

```ts
analytics.query({
  workspaceId, scope: { linkIds? | tagIds? | campaignId? | domain? | qrIds? },
  range: { from, to, tz }, interval: "hour"|"day"|"week"|"month",
  metrics: ["clicks","scans","uniques"?], groupBy?: "country"|"city"|"device"|"browser"|"os"|"referrer"|"utm_source"|…,
  filters?: { country?, device?, … }, limit?
})
```

- Uniques are approximate: `uniques` = distinct `ipHash+uaHash` per day, computed in the worker with Redis HyperLogLog (`PFADD hll:{linkId}:{day}`) and flushed to rollups as a number. HLL also works for unions across links and ranges.
- Timezone-correct day buckets: rollups are stored in UTC hours (`byHour`), and day/week aggregation in the user's timezone is computed from hourly data in queries over ≤ 400 days. For longer ranges, UTC days are used and the UI notes it.

## Exports

- CSV/JSON export of raw events (bounded by plan) and of aggregates runs as a BullMQ job. It streams from Mongo → CSV (papaparse unparse stream) → R2, then emails or notifies a signed URL valid for 24 h. This replaces the synchronous `json2csv` generation in server actions.

## Search (decided: Meilisearch)

The database is self-hosted, so Atlas Search isn't available. **Meilisearch** stays, run self-hosted on the Forge box (or pi-cloud), bound to the private network with a master key.

- Indexes: `links`, `qr_codes`, `bio_pages`, `campaigns`. Each has `workspaceId` as a filterable attribute, and every query sets the filter server-side with a **tenant token** scoped to the workspace, so the client never builds the filter.
- Sync: the worker's change-stream consumer (02 §3a.3) upserts and deletes documents in Meilisearch, batched every 1 s. The resume token is persisted separately from the cache-invalidation consumer. A nightly full reindex job diffs counts and repairs drift.
- Meilisearch is derived data. Losing it costs a reindex, never data. List pages work without it (keyset pagination on Mongo), and search degrades to a prefix match on `key` if Meilisearch is down.

## Acceptance

- Golden test: N synthetic clicks through redirect → exactly N events, N in rollups, N in `links.stats`. A forced worker crash mid-batch still yields N.
- Dashboard p95 < 300 ms for 1-year range on the largest workspace (Vida Económica) in staging with prod-sized data.
- Backfilled events reconcile with legacy per M7 verification.
