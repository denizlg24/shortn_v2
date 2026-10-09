# 11 — Bulk Import & Export

## CSV import (links)

1. Upload a CSV (≤ 10 MB / 50k rows) or paste URLs. The file goes to R2 via a presigned PUT and never passes through server memory.
2. **Mapping step:** auto-detected columns (`url|destination|long_url`, `key|slug|code`, `title`, `tags`, `utm_*`, `expires_at`, `domain`) with a preview of the first 20 rows, a row count, and validation errors per row.
3. Dry run in the worker: validate every row (URL format, key rules, reserved words, uniqueness per domain, plan limits). The summary reads "4,982 will be created · 12 keys taken · 6 invalid URLs", with downloadable error CSV.
4. Commit: BullMQ job processes rows in chunks of 500 via `packages/core/links.createMany` (same validation, safety scan queued, cache warm-up). Progress streams to the UI through polling on `imports/{id}`. It's **resumable**: the checkpoint is the row index, and each row's idempotency key is `importId:row`.
5. **Plan limits:** an import that would exceed the period's link limit is refused up front with the exact numbers. The user can't end up with a half-imported file because of a limit.
6. **Competitor importers (P6+):** Bitly, Dub and Rebrandly CSV export formats map automatically (column presets).

## Import of QR codes

The same pipeline with `type: "qr"` creates link + QR with a default design.

## Exports

| Export                                     | Format             | Delivery                                               |
| ------------------------------------------ | ------------------ | ------------------------------------------------------ |
| Links (filtered view)                      | CSV / JSON         | instant stream for < 5k rows, else job → R2 signed URL |
| Analytics (aggregates)                     | CSV                | job                                                    |
| Analytics (raw events, within plan window) | CSV / NDJSON       | job                                                    |
| QR codes (selection)                       | ZIP of SVG/PNG/PDF | job                                                    |
| Full workspace (GDPR)                      | ZIP of JSON + CSV  | job, email link (05)                                   |

Job results expire after 24 h (R2 lifecycle rule).

## Outgoing webhooks

Specified in [10](10-api-mcp-llms.md#outgoing-webhooks). Import completion emits `import.completed`.

## Acceptance

- Import of 50k rows completes in < 5 min on staging. Killing the worker mid-import and restarting finishes without duplicates.
- Round trip: export links CSV → import into a new workspace → identical destinations, keys (when free), tags and UTM.
