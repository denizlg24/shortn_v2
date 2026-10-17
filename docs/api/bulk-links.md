# Create links in bulk

`POST /v1/links/bulk` accepts a JSON object with a `links` array of 1–1,000
link creation inputs. The entire request body must fit within 1 MiB. Use a key
with `links:write` whose creator can create resources in the workspace.
Each row supports the same destination, domain, key, title, description, tags and
password options, validation and plan gates as `POST /v1/links`.

```sh
curl https://api.shortn.at/v1/links/bulk \
  -H "Authorization: Bearer $SHORTN_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: campaign-launch-001' \
  --data '{"links":[{"url":"https://example.com/first","tags":["Launch"]},{"url":"https://example.com/second","tags":["Launch"]}]}'
```

## Results and atomicity

A successful request returns HTTP 201 with `count` and `items` in the input order.
Each item has the same shape as a newly created individual link. Destination
safety starts pending, with a durable background scan request committed alongside
each link. The worker scans new destinations and retries failures; configured
safety and password gates still apply at redirect time. If there are enabled
subscribers, each link produces its own `link.created` event.

The batch commits in one Mongo transaction. Invalid input, taken or duplicate
keys, a missing plan feature, insufficient quota, or a database/event write failure
creates no batch links or new tags. A workspace quota check covers the entire
batch and is serialized with other v2 link and QR backing-link creation requests.
Keys are checked again inside the transaction; database uniqueness handles racing
inserts. Foreign-workspace tags are never reused, including when legacy owner
fields happen to match.

Errors use `application/problem+json`. Validation or key errors may include a
`context.index` identifying the zero-based input row. HTTP 409 `limit_reached`
includes `context.limit`, `context.used` and `context.requested` so the integration
can show the exact remaining capacity. A validation failure in the request envelope
returns HTTP 400; an oversized body returns HTTP 413.

## Retries

Send a unique `Idempotency-Key` for each intended batch and retain it for retries.
The original status and response are retained for 24 hours. Reusing the key with a
different request returns HTTP 409 `idempotency_conflict`. An uncertain in-flight
operation returns `idempotency_pending`; it is not reissued automatically.
Feature flags, membership, role and scopes are checked before replaying a response.

This endpoint creates a bounded batch. CSV upload, mapping, dry runs, whole-import
quota reservation and resumable background imports remain separate work.
