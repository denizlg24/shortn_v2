# 13 — Infrastructure, Ops & Security

## Forge layout (production)

One VPS to start (≥ 4 vCPU / 8 GB, EU region: Frankfurt or Amsterdam, near Atlas `eu-central`/`eu-west`), sized so redirects and Redis can move to a second box without code changes.

| Process                    | Supervisor   | Instances             | Notes                                                                                                                                                                                          |
| -------------------------- | ------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nginx                      | system       | 1                     | host routing (07), Cloudflare-only real IP, gzip/brotli, `limit_req` as last-resort rate limit                                                                                                 |
| apps/redirect              | Forge daemon | cores − 1 (reusePort) | stateless                                                                                                                                                                                      |
| apps/web (Next standalone) | Forge daemon | 2 (ports 3000/3001)   | zero-downtime deploy by rolling restart                                                                                                                                                        |
| apps/api                   | Forge daemon | 2                     |                                                                                                                                                                                                |
| apps/worker                | Forge daemon | 1–2                   | BullMQ + stream consumers; graceful shutdown on SIGTERM (finish batch, ack)                                                                                                                    |
| Redis 7                    | system       | 1                     | bound to localhost/private net, `requirepass`, AOF everysec + RDB, `maxmemory-policy noeviction` for the streams/queues DB; a **separate logical DB or instance** with `allkeys-lru` for cache |
| legacy app                 | Forge daemon | until P7              |                                                                                                                                                                                                |

- **Redis split (important):** cache keys can be evicted, but queues and streams must not be. Either two Redis instances (`redis-cache` LRU on port 6380, `redis-durable` noeviction on 6379) or one instance with `noeviction` and explicit TTLs on all cache keys. Recommendation: **two instances**. It's simple and prevents a cache surge from failing click ingestion.
- **Deploys:** GitHub Actions builds per-app artifacts, then the Forge deploy hook pulls the commit and runs `bun install --frozen-lockfile && turbo build --filter=<changed>`. `db:indexes` runs (create-only), then pending **expand** migrations run (never contract), then a rolling restart and a health check gate. The legacy deploy script stays separate.
- **Staging:** a second smaller Forge server on `*.staging.shortn.at`, using a restored anonymized prod snapshot that's refreshed weekly.

## Cloudflare

- Proxied DNS for all hosts; Full (strict) TLS with an Origin CA cert; HSTS preload kept.
- WAF managed rules on `app.` and `api.`; rate-limiting rules on `/authenticate/*`, `/api/auth/*` and the marketing demo shortener.
- "Add visitor location headers" managed transform (geo for analytics, 03).
- Cache rules: bio pages (07/08), `/_next/static/*` immutable, `assets.shortn.at` (R2) long cache. **Redirect responses are not cached**, so analytics stay accurate.
- Cloudflare for SaaS: custom hostnames with fallback origin `cname.shortn.at` (07).
- R2 buckets: `shortn-assets` (public via `assets.shortn.at`), `shortn-exports` (private, 24 h lifecycle), `shortn-backups` (private, versioned, 30–90 d lifecycle).
- Turnstile on signup, contact and the public demo shortener and report forms.

## Backups & DR

- Atlas: continuous backup with PITR (≥ 7 days) **verified in P0**. If the tier lacks it, a nightly `mongodump --gzip --oplog` to `shortn-backups` (worker cron) runs as a stopgap until the tier is upgraded.
- Redis: AOF `everysec` on the durable instance; RDB copied to R2 every 6 h. **Unprocessed click events exist only in the stream** (or the redirect spool file) until written to Mongo, so durable-instance health is monitored like a database. Cache and counters are rebuildable from Mongo.
- **Restore drill** every quarter and before P7: restore to staging, run all migration `verify`s and the redirect golden suite.
- RPO: ≤ 1 min (Mongo PITR); clicks ≤ ~1 s (Redis AOF). RTO: < 1 h for a full box loss (re-provision via Forge recipe + restore).

## Observability

- **Errors:** Sentry for web (`@sentry/nextjs`, tunnel kept), api, redirect and worker (`@sentry/bun`). Release tagging from CI. Remove `automaticVercelMonitors`.
- **Metrics:** Prometheus endpoints on redirect/api/worker → Grafana Cloud free tier (or self-hosted). Dashboards: redirect latency and hit ratio, stream lag and pending, queue depth per job, Mongo op latency, Redis memory and evictions (cache instance only), webhook failure rate.
- **Logs:** structured JSON (pino) → journald → shipped (Grafana Loki or Better Stack). No PII in logs; IPs are hashed.
- **Uptime:** external checks on `shortn.at/{canary-key}`, `app.`, `api./health`, and a bio handle. Status page at `status.shortn.at`.
- **Alerts:** redirect p95 > 50 ms (5 min), 5xx > 0.5%, stream lag > 60 s, dropped click events > 0, queue failure spikes, backup job failure, Polar reconciler drift, certificate/custom-hostname failures.

## Security (closes `SECURITY_AUDIT.md` items structurally)

- **Secrets:** zod-validated, no fallbacks between secrets, and each purpose has its own secret (`LINK_ACCESS_SECRET`, `CONFIRMATION_TOKEN_SECRET`, `IP_HASH_SECRET`, `API_KEY_PEPPER`). Rotation is documented, with key IDs where tokens persist.
- **AuthZ:** a single `can()` in core with a matrix test (05). Every repository call is scoped by `workspaceId` from the authorized context.
- **Input:** zod at every boundary. URL normalization and validation rejects `javascript:`, `data:` and internal hosts (SSRF guard for title fetch, link health and webhooks: block private ranges after DNS resolution).
- **Open-redirect abuse:** safety pipeline (09), report form (kept), rate limits on creation for free accounts, Turnstile, and a domain blocklist synced from public feeds.
- **Headers:** CSP per surface (strict on app/api, allowlisted embeds on bio), the existing security headers kept, `X-Frame-Options DENY` on app.
- **Passwords:** argon2id rehash-on-login for link passwords (02 §M9). better-auth handles account passwords.
- **Webhooks in:** Polar signature verification + idempotency (06). Webhooks out: HMAC-signed (10).
- **Admin/impersonation:** kept, audited in `audit_log`, visible banner, time-boxed.
- **Dependencies:** grouped Dependabot, `bun audit` in CI, lockfile committed.
- **GDPR:** EU hosting (Atlas EU + Forge EU + Cloudflare), no raw IPs in new analytics, DPA + subprocessors page (Atlas, Cloudflare, Polar, Resend, Sentry, Google Web Risk), data export and deletion (05), and cookie consent only where needed (embeds on bio pages, since analytics is cookieless).

## Email

Resend only, with react-email templates in `packages/emails` (en/pt/es). Sent through the BullMQ `email` queue with retries. The nodemailer/webmail path is retired after verifying no flow still depends on it (contact confirmation used `WEBMAIL_*`).
