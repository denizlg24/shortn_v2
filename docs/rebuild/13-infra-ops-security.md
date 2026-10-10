# 13 — Infrastructure, Ops & Security

## Forge layout (production)

"Forge" is the self-hosted container platform at `forge.denizlg24.com` (not Laravel Forge; verified 2026-10-09 against `denizlg24.com/apps/deploy-agent`). It runs on its own box (12 cores, 32 GB), separate from pi-cloud, which keeps MongoDB, Meilisearch and S3.

- **Ingress:** Cloudflare → `cloudflared` tunnel → Caddy on the Forge box → the target's container. Caddy matches on **hostname only**: no path routing, no mirroring, no weighted split, and there is no nginx to configure. Path-level routing on `shortn.at` lives in a Cloudflare Worker (below). The box has no public ports, so every request arrives through Cloudflare.
- **Targets:** one Forge target per app (15 §Containers), each with its own origin hostname. A target is one container (`cpuLimit`, memory reservation/ceiling), built from its Dockerfile with the repo root as context. No volumes, an HTTP health check on `healthPath`, a new port and container name per deploy. **Never put state in a target.**
- **Deploys:** push to the target's branch → build → start the new container → health check → Caddy switches → the old container is reaped. 503s were observed for a few seconds during a swap on 2026-10-09. **P2 entry criterion:** measure the swap under load on staging; if it isn't gapless, fix it in the deploy agent before redirects move. The Worker's legacy fallback (below) covers a failed or slow origin in the meantime.

| App                        | Forge target         | Notes                                                                                    |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| legacy app                 | `shortn` / `staging` | `legacy/Dockerfile`, until P7                                                            |
| apps/redirect              | `shortn-redirect`    | Bun, stateless; scale with `cpuLimit` and `reusePort` workers in one container           |
| apps/web (Next standalone) | `shortn-web`         |                                                                                          |
| apps/api                   | `shortn-api`         |                                                                                          |
| apps/worker                | `shortn-worker`      | no domain; `healthPath` served on an internal port; graceful SIGTERM (finish batch, ack) |

- **Redis (built 2026-10-09):** host units on the Forge box, not targets and not the Pi's shared Redis. That one is `allkeys-lru` with 128 MB shared across projects, and LRU would silently evict stream entries and jobs. `forge-redis@<instance>` (`denizlg24.com/infra/systemd/forge-redis-install`) runs on the `forge-apps` Docker network, reachable by name, not published:

  | Instance                 | Role                             | maxmemory | Env                 |
  | ------------------------ | -------------------------------- | --------- | ------------------- |
  | `shortn-cache`           | `allkeys-lru`, no persistence    | 256 MB    | `REDIS_CACHE_URL`   |
  | `shortn-durable`         | `noeviction`, AOF everysec + RDB | 512 MB    | `REDIS_DURABLE_URL` |
  | `shortn-staging-cache`   | as above                         | 64 MB     | staging target      |
  | `shortn-staging-durable` | as above                         | 128 MB    | staging target      |

  Same box as redirect and worker, so the hot path (`GET link:*`, `XADD`) never crosses to the Pi, and a pi-cloud outage leaves redirects serving from cache while clicks buffer in the stream (03 degraded mode). Resize by re-running the installer; it keeps the password.

- **Migrations:** `db:indexes` (create-only), then pending **expand** migrations, run as a one-off step before the new container takes traffic. Never contract.
- **Staging:** separate Forge targets on the same box, dashed hosts (15).
- **Open:** Forge targets have no volumes, so the redirect spool (03 degraded mode) is lost if a container is replaced while Redis is down. Either accept it or add a host-volume option to the deploy agent for `shortn-redirect`. Decide before P2.

## Edge routing (Cloudflare Worker)

A Worker on `shortn.at/*` (and later the custom-hostname zone) does what the old plan gave nginx:

- **Routing:** a single-segment path that is not reserved (`packages/core/reserved.ts`, bundled into the Worker at build) or `/qr/{key}` goes to the redirect origin. Everything else goes to the legacy origin, and to the web origin from P4. The table in 14 is the Worker's config, one entry per phase.
- **Kill switch (P2):** `hash(cf-ray) % 100 < CANARY_PERCENT` sends redirect paths to the redirect origin. It ships at 100 and is only lowered to roll back. `CANARY_PERCENT` and the per-path owner live in Worker vars; a change is one `wrangler deploy` of config (seconds). There's no shadow mode: parity is checked offline over every key (14 P2).
- **Fallback:** a 5xx or timeout from the redirect origin is retried once against legacy, so a bad deploy or a Forge swap degrades to legacy rather than to an error.
- **Headers:** the Worker forwards `CF-Connecting-IP`, the geo headers and `X-Request-Id` (from `cf-ray`). Origins trust them because the box is reachable only through the tunnel.
- Worker subrequests to the zone's own origin hostnames skip Worker routes, so there are no loops. Origin hostnames (e.g. `redirect-origin.shortn.at`) are proxied tunnel records with no Worker route.
- **Cost:** free plan. Measured 2026-10-09: ~60 redirects/day (1,000 clicks over 16 days, steady since July), against 100k Worker requests/day. Keep `/_next/*` and other static paths off the Worker route, and set the route to **fail open**, so hitting the limit sends traffic to the default origin (legacy until P7, which resolves every key) instead of erroring. Revisit only if daily requests approach the limit.

## Cloudflare

- Proxied DNS for all hosts; Full (strict) TLS with an Origin CA cert; HSTS preload kept.
- WAF managed rules on `app.` and `api.`; rate-limiting rules on `/authenticate/*`, `/api/auth/*` and the marketing demo shortener.
- "Add visitor location headers" managed transform (geo for analytics, 03).
- Cache rules: bio pages (07/08), `/_next/static/*` immutable, `assets.shortn.at` (R2) long cache. **Redirect responses are not cached**, so analytics stay accurate.
- Cloudflare for SaaS: custom hostnames with fallback origin `cname.shortn.at` (07).
- R2 buckets: `shortn-assets` (public via `assets.shortn.at`), `shortn-exports` (private, 24 h lifecycle), `shortn-backups` (private, versioned, 30–90 d lifecycle).
- Turnstile on signup, contact and the public demo shortener and report forms.

## Backups & DR

- **MongoDB (self-hosted on pi-cloud, 8.2.11, single-node replica set `rs0`):**
  - **Percona Backup for MongoDB (PBM)** agent on the node: daily logical/physical full backup + continuous **oplog slicing (PITR)** to the R2 bucket `shortn-backups` (S3-compatible endpoint), retention 30 days full / 7 days PITR, encrypted at rest (SSE + PBM encryption key held outside the box).
  - A second copy: a weekly `mongodump --gzip --oplog` to a different provider/location (e.g. the Forge box disk → offsite), so one compromised credential can't destroy both.
  - The oplog is sized for ≥ 72 h at peak write rate (change-stream resume + PITR continuity).
  - **Single point of failure:** one node means no failover and every maintenance window is downtime for dashboard writes. Redirects survive on Redis (03 degraded mode), but clicks queue in the stream. **Recommendation:** add a second data-bearing member plus an arbiter (or 3 data members) to `rs0`, ideally one off pi-cloud. This isn't blocking, but it's strongly advised before P4.
  - Connection: TLS required (`tls=true`), SCRAM credentials per app with least-privilege roles (redirect: read on links/QR; worker: readWrite on analytics + sync; web/api: readWrite), and port 27018 open **only** to the Forge box. Keep `directConnection=true`: `rs0` advertises its member as the Docker-internal `mongodb:27017`, so `replicaSet=rs0` cannot connect from Forge.
- Redis: AOF `everysec` on `shortn-durable`; its data dir is in the Forge DR allowlist (`denizlg24.com/infra/dr`). **Unprocessed click events exist only in the stream** (or the redirect spool file) until written to Mongo, so durable-instance health is monitored like a database. Cache and counters are rebuildable from Mongo.
- **Restore drill** every quarter and before P7: restore to staging, run all migration `verify`s and the redirect golden suite.
- RPO: ≤ 1 min (PBM PITR); clicks ≤ ~1 s (Redis AOF). RTO: < 1 h for a full box loss (Forge DR restore, then redeploy targets from their recovery images).

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
- **GDPR:** EU hosting (pi-cloud + Forge EU + Cloudflare), raw IPs kept 90 days only, for abuse handling, DPA + subprocessors page (pi-cloud, Cloudflare, Polar, Resend, Sentry, Google Web Risk), data export and deletion (05), and cookie consent only where needed (embeds on bio pages, since analytics is cookieless).

## Email

Resend only, with react-email templates in `packages/emails` (en/pt/es). Sent through the BullMQ `email` queue with retries. The nodemailer/webmail path is retired after verifying no flow still depends on it (contact confirmation used `WEBMAIL_*`).
