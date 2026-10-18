# QR exports

QR exports are implemented and verified locally. They are disabled by default;
external storage and staging acceptance remain open. The worker produces SVG,
PNG and print-sized PDF artifacts from an immutable design snapshot. Single and
selected ZIP dashboard exports include review, progress and private downloads.

## Enablement

Set `QR_EXPORTS_ENABLED=1` on the web dashboard, API and worker. Each requires
`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
`S3_SECRET_ACCESS_KEY`, pointing at the same private S3/R2-compatible bucket.
The worker also requires `APP_URL`; `APP_URL` and optional `PUBLIC_ORIGIN`
define the allowed origins of stored upload logos. Production origins require
HTTPS. Provision the declared job indexes with `bun run db:indexes` and run the
worker with the existing durable Redis configuration. REST and MCP retain their
independent mount and workspace rollout gates.

The public assets route serves only validated `uploads/` keys. Export objects
under `exports/qr/` are delivered by signatures after authorization. Keep this
cache prefix private and available for every active job's delivery lifetime;
job access and signatures expire after 24 hours. ZIP output under
`exports/jobs/qr/` needs a 24-hour lifecycle; it must also remain private.

## REST

Use a bearer API key with `qr:read`. Viewers can export codes they can read.
Exporting does not edit the QR code or require `qr:write`.

```sh
curl --max-redirs 0 -i \
  -H "Authorization: Bearer ${SHORTN_API_KEY}" \
  'https://api.shortn.at/v1/qr-codes/QR_ID/export?format=png&size=1024'
```

`format` is `svg`, `png` or `pdf` (default `svg`); `size` is an integer from
128 through 4096 pixels (default 1024). `202 Accepted` returns an export job and
an authenticated polling path in `Location`, with `Retry-After: 1`:

```json
{
  "id": "JOB_ID",
  "state": "pending",
  "format": "png",
  "size": 1024,
  "createdAt": "2026-10-15T10:00:00.000Z",
  "expiresAt": "2026-10-16T10:00:00.000Z"
}
```

Poll `GET /v1/qr-exports/JOB_ID` using the same workspace credential. The status
is `pending`, `running`, `completed` or `failed`. Completed jobs include
`downloadUrl`, `downloadExpiresAt` and print guidance. The download URL is a
private attachment signature valid only for the remaining job lifetime. A
repeated export request redirects with `303 See Other` when ready; use `curl -L`
to follow that redirect and save the artifact. Cross-origin clients can read
`Location`, `Retry-After` and rate headers. Status responses use
`Cache-Control: private, no-store` and omit the stored design and object key.

Equivalent requests for the same creator/design/format/size in the same UTC day
reuse the job. The worker retries temporary storage failures and resumes expired
leases. New requests after a design change produce a new snapshot. A failed
print design returns a stable failure code; repeated export requests return
`409 export_failed` with the job ID and reason. Temporary signing failure returns
`503 storage_unavailable`. Expired, foreign or inaccessible jobs return `404`;
revoked credentials return `401`.

## Dashboard

From a QR code, choose **Export for print**, then SVG, PNG or PDF and a size
from 128 to 4096 px. The preview uses corrected print options, and the page shows
minimum print guidance. JPEG remains available separately for screen use. With
the flag off, existing browser downloads remain available.

In the QR library, select codes across pages and filters and choose
**Export selected**. Viewers can export readable codes. The review supports the
library’s searchable tag, date and keyword filters, date grouping and 25-row
server pages. Filters change the review list; the ZIP includes the entire
selection shown in the count, up to 500 codes and 512 MiB. A short, private
selection reference is bound to the current workspace and user for 24 hours.

The status page polls while visible, shows preparation counts, and stops polling
when the job completes or fails. It provides a private attachment download and
its expiry, or a clear error and a link to review a failing design. Current
membership and resource access are rechecked on each request. A selection that
loses an item before submission is rejected without creating a job.

## Selected QR ZIP

`POST /v1/qr-codes/export` queues a ZIP job with `qr:read`, including for viewers.
Send `ids` (1–500 selected QR IDs), `format` (`svg`, `png` or `pdf`) and optional
`size` (128–4096, default 1024). Duplicate IDs are collapsed; every selected code
must belong to the workspace. A mixed foreign/missing selection creates no job.
Use `Idempotency-Key` for request replay. Equivalent selections, independent of
order, reuse the same creator/day/design job.

The 202 response includes the job ID, `total`, `done`, the 500-code `limit`, and
`maximumBytes: 536870912` (512 MiB). Poll the authenticated `Location` at
`GET /v1/qr-exports/zip/JOB_ID`. `phase` is `rendering` or `assembling`; `done`
counts checkpointed artifacts. The worker persists one immutable item snapshot
per selected code, processes cursor batches, and resumes completed items after
retry or lease recovery. ZIP names are safe, unique flat filenames. A print
failure identifies `failedQrId` and its stable reason.

Archives stream to private multipart storage rather than accumulating the
entire ZIP in worker memory. Output above 512 MiB fails as `archive_too_large`
and incomplete multipart uploads are aborted. A completed status includes the
expiring attachment URL. Current membership and every selected resource are
checked before signing; foreign, deleted or expired selections cannot be
retrieved. Configure a 24-hour lifecycle for `exports/jobs/qr/`, separately from
the reusable design cache under `exports/qr/`.

## MCP

`create_qr_code` accepts optional `format` and `size` alongside `linkKey`,
`domain` and `style`. It requires `qr:write` and `links:read`. With exports enabled,
it waits up to five seconds for the worker and returns the signed `exportUrl`
when ready. If still processing, it returns `exportJobId`, `exportStatus` and a
null `exportUrl`. Poll `get_qr_export {id: exportJobId}` with `qr:read` to obtain
the finished download URL. This is the twelfth tool, added to the eleven planned
workspace tools for asynchronous delivery.

When export configuration is disabled, QR creation still succeeds with
`exportStatus: "disabled"`. If export fails after QR creation, the result retains
the created QR ID and available job ID; it reports the export failure without
presenting the QR mutation as failed. Polling is read-only; QR creation retains
its mutation audit actor and record.

## Print output

Print plans enforce a quiet zone of at least four modules, error correction Q
minimum (H with a logo), opaque colors and at least 3:1 module/background contrast,
including finder colors and gradients. Six dot/finder styles, linear/radial
paints and stored PNG logos are supported. Sizes, payloads and logo bytes are
bounded. The worker reads logos directly from validated stored upload keys;
it does not fetch arbitrary image URLs.

PDF page dimensions preserve 300 dpi. `print.minimumMm` recommends a physical
size using four printer pixels per module at 300 dpi. Circular legacy designs currently fail explicitly. Frame/caption treatment
remains unimplemented. The local parity fixture verifies corrected
print previews against server artifacts at 1024 px.
