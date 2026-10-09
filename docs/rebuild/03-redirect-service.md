# 03 — Redirect Service (`apps/redirect`)

Goal: resolve any short link in **< 5 ms p95 server time on a cache hit** and < 30 ms on a miss. No database writes happen on the request path. Behavior matches legacy for every existing link.

## Why a separate service

Today each redirect goes through Next's proxy (next-intl, better-auth cookie parsing), then a route handler with three Mongo round-trips and a racy `save()`. Redirects are >95% of traffic and have nothing to do with React. A ~300-line Bun + Hono process can serve them, and it can stay up while the dashboard is deploying.

## Request flow

```
GET https://{host}/{key}[?query]
  │
  ├─ host routing (07): shortn.at | custom domain | {handle}.shortn.at (→ web) | app./api. (→ never reaches here)
  ├─ reserved path? (/, /pricing, /login, /_next, /llms.txt, …) → proxy to apps/web (nginx does this first, see 07)
  ├─ /qr/{key}  (legacy QR path)   → same resolution as /{key}; scan vs click decided by link flags (isQrCode && qrCodeId && QR doc), as legacy does. The /qr/ prefix is NOT a scan marker
  ├─ /b/{slug}  (legacy bio)       → stays on legacy until P5; then 301 to the page's current handle (bio_aliases → bioPageId)
  │
  ├─ resolve(domain, key):
  │    L1 in-process LRU (10k entries, 10 s TTL)           ── hit → done
  │    L2 Redis  GET link:{domain}:{key}  (msgpack)         ── hit → fill L1
  │    L3 Mongo  links.findOne({domain,key}) projection     ── fill L2 (TTL 1 h + jitter), fill L1
  │         miss → try previousKeys alias → 301 to canonical key's resolution (still counts)
  │         miss → negative-cache `link:{domain}:{key}` = ∅ for 60 s → 404 page
  │
  ├─ gates (in order, identical to legacy semantics):
  │    disabled | safety blocked/malicious → 302 /{locale}/safety/{key}
  │    interstitial | suspicious (no valid confirm token) → 302 safety page
  │    password (no valid link_access_{key} cookie)       → 302 /authenticate/{key}
  │    rules (09): not yet active / expired → branded page; geo/device targeting → pick destination; rotation → weighted pick
  │
  ├─ enqueue click (fire-and-forget): XADD clicks:stream * { … }   (≈0.2 ms, pipelined; NO MAXLEN, see 04 trimming)
  └─ 302 Location: destination (+ forwarded query params per link setting)
```

**Status codes:** 302 is the default, as in legacy, so analytics aren't eaten by browser caches. Per-link `301` is an option (exposed in UI as "permanent", with a warning). `Cache-Control: private, max-age=0`. `Referrer-Policy` follows the link setting (default `unsafe-url`, as today's behavior implies).

**Bots:** `isbot(ua)` → the redirect still happens, but the event is enqueued with `bot:true`. The worker stores bot events in a separate counter only, so they stay out of user analytics, and their volume stays visible for abuse detection. Link-preview bots (Slack, X, WhatsApp, iMessage) get an **OG HTML page** when the link has an OG override (09). Otherwise they get the 302.

## Cache coherence

The cached payload is a minimal projection:

```ts
type CachedLink = {
  id;
  ws;
  dest;
  status: 0 | 1 | 2 /*ok|interstitial|blocked*/;
  pwd: boolean;
  rules?: CompiledRules;
  qr: boolean;
  perm: boolean;
  fwdQuery: boolean;
  v: number;
};
```

- **Writes go through `packages/core`.** Every link mutation calls `linkCache.invalidate(domain, key)`, which `DEL`s the key in Redis and `PUBLISH`es `link-invalidate {domain,key}`. Each redirect instance subscribes and evicts from L1. Worst-case staleness is 0 for L2 and ≤10 s for L1 if the pub/sub message is lost.
- **Legacy app during coexistence (P2–P4):** legacy writes to Mongo directly. The resolver reads **legacy fields as the source of truth** (02 §3a.1): `{domain,key}` or `{urlCode:key}`, with the decision projected from `longUrl`, `disabled`, `safetyStatus`, `requiresInterstitial` and `passwordProtected`. Lag in the new-field derivation therefore can't serve stale data. Invalidation uses two mechanisms, and both apply:
  1. A patch to **every** legacy write site of `urlv3s`/`qrcodesv2`: link and QR actions (`linkActions.ts` create/update/rename/delete/UTM), `lib/safety/index.ts:99` (scanAndPersist), `app/actions/reportActions.ts:79-94` (report auto-disable), `app/api/cron/moderate/route.ts:59` (moderation `updateMany`), and `app/actions/tagActions.ts:41,118,154`. After a successful write, each calls `invalidateLinkCache(codes[])` (Redis `DEL` positive **and negative** entries + `PUBLISH`). A rename invalidates both the old and new code.
  2. Safety net: a **change stream** on `urlv3s` and `qrcodesv2` with pre-images (`fullDocumentBeforeChange`) and `updateLookup`. It invalidates both the before and after key on every update, delete and `updateMany`, because delete events alone carry only `_id`. The resume token is persisted in Redis. On a lost token or `ChangeStreamHistoryLost`, **flush all `link:*` keys**.
- Negative cache: `∅` entries are deleted by every invalidation, and every create writes the positive entry (write-through). A link created in legacy is invalidated (patch + stream) before its first click can arrive in practice. The worst case is a 60 s 404 if both mechanisms fail, which is alerted on via the stream lag metric.
- Moderation actions (disable, block) also invalidate. That's critical, because a cached malicious link must stop resolving immediately.
- Stampede protection: single-flight per key within a process, and a Redis `SET NX` lock of 2 s for misses across instances.

## Safety, confirmation & passwords

- The safety page, authenticate page and branded 404/expired pages are rendered by **apps/web** (localized). The redirect service only issues 302s to them, exactly as now.
- The confirmation token (`verifyConfirmationToken`) moves to `packages/core/safety` and is signed with `CONFIRMATION_TOKEN_SECRET`.
- Password cookies are verified with `jose`. The redirect service never verifies passwords itself; it only checks the cookie. Verification stays on legacy `/authenticate` until P4, and the secret and hash transitions follow 02 §M9. Brute-force protection on `/authenticate` uses a Redis sliding window (5 per minute per IP+key, 50 per hour per key).

## Client identity & geo

- Forge sits behind Cloudflare. **Only trust Cloudflare headers when the socket peer is a Cloudflare IP.** nginx's `set_real_ip_from` uses Cloudflare's published ranges (refreshed by cron) with `real_ip_header CF-Connecting-IP`. The service reads `X-Real-IP` set by nginx. This is the same principle as the fix in #413, enforced at the edge.
- Geo comes from Cloudflare headers: `CF-IPCountry` always; city, region, continent, lat/long and timezone via the **"Add visitor location headers"** managed transform (`cf-ipcity`, `cf-region`, `cf-timezone`, …). This removes ip2location.
- The IP is hashed in the worker, never in the stream payload stored long-term (the stream is trimmed).

## Implementation notes

- Hono on `Bun.serve` with `reusePort: true`. Run **N processes = cores − 1** under Forge's daemon supervisor (or systemd). Stateless.
- Mongo pool 20 per process, read preference `primary` for misses (correctness over latency, since misses are rare). New links are also **written to Redis on create** (write-through), so the first click on a fresh link never hits Mongo.
- Redis via `ioredis` with `enableAutoPipelining`.
- Health: `/__health` checks Redis ping + Mongo ping (cached 5 s). nginx `max_fails` handles failover between processes.
- **Degraded modes:**
  - Redis down → resolve from Mongo directly (L1 still helps). Click events are appended to a **local append-only spool file** (fsync batched every 100 ms). It survives restarts and deploys and is replayed into the stream when Redis returns. The spool is capped by disk-space alerting, not by count, so dropping events requires a full disk, which is itself alerted.
  - Mongo down → serve from L1/L2 only. Misses → 503 page with `Retry-After`.
- Observability: Sentry (errors only, sampled), and a Prometheus `/metrics` endpoint scraped by the Forge monitoring stack or Grafana Cloud (13). Metrics are hit ratio L1/L2, resolve latency histogram, stream lag, dropped events.

## Key generation & reserved words (shared, `packages/core/links/keys.ts`)

- Random keys: nanoid with alphabet `[A-Za-z0-9]` (no `-`/`_`, which avoids lookalikes at the edges), default length 7 (62⁷ ≈ 3.5e12). Insert with the unique index and **retry on E11000** (max 5, then length+1). This replaces the unchecked `nanoid(6)`.
- Custom keys: `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, not in `RESERVED_KEYS` (union of legacy `PUBLIC_PATHS`, locale codes, `qr`, `b`, `api`, `app`, `_next`, `monitoring`, `llms.txt`, `robots.txt`, `sitemap.xml`, `.well-known`, plus a profanity/brand-impersonation list), and validated **at creation time**, not only in the proxy.
- Renaming a key: the old key is pushed to `previousKeys` and keeps resolving (301 to the same destination, counted against the same `linkId`). **A key or alias that has ever received traffic is never reassigned to another workspace**, including keys of soft-deleted and hard-deleted links (`retired_keys`), because printed QR codes may encode it. The owner can re-point it within their own workspace. Analytics are keyed by `linkId`, so history is never orphaned again.
- Charset: legacy never validated custom codes, so existing keys outside `[A-Za-z0-9_-]` (M0 #15) are grandfathered and resolved by exact match on the percent-decoded path. Golden tests cover every such key in prod.

## Tests

- Golden behavior suite: for a fixture set covering normal, QR-backed, legacy `/qr/`, password, interstitial, suspicious, blocked, disabled, renamed alias, bot and missing links, assert the status, `Location` and enqueued event _for both legacy and the new service_. The cutover gate is identical outputs (14).
- Load test (k6) on staging: 2k rps sustained at a 99% hit ratio, p95 < 10 ms at nginx.
