# 07 — Domains & Subdomains

## Host map

| Host                                        | Served by                               | Notes                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shortn.at/` and marketing paths            | apps/web (marketing route group)        | `/`, `/{locale}/…`, `/pricing`, `/legal/*`, `/blog`, `/docs`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/_next/*`, `/safety/*`, `/authenticate/*`, `/abuse` |
| `shortn.at/{key}`, `/qr/{key}`, `/b/{slug}` | apps/redirect                           | anything single-segment that isn't reserved                                                                                                                    |
| `app.shortn.at`                             | apps/web (dashboard route group)        | auth cookies are host-only here                                                                                                                                |
| `api.shortn.at`                             | apps/api                                | REST v1, `/mcp`, `/webhooks/*`, `/openapi.json`, `/docs` (Scalar)                                                                                              |
| `{handle}.shortn.at`                        | apps/web (bio route group)              | public, cacheable, no cookies                                                                                                                                  |
| `assets.shortn.at`                          | Cloudflare R2 public bucket             | user uploads, QR exports                                                                                                                                       |
| `status.shortn.at`                          | external status page                    |                                                                                                                                                                |
| `www.shortn.at`                             | 301 → `shortn.at`                       | kept                                                                                                                                                           |
| customer domains (`go.brand.com`)           | apps/redirect (links) or apps/web (bio) | via Cloudflare for SaaS                                                                                                                                        |

**Reserved subdomain labels** (can't be handles): `app, api, www, assets, status, docs, blog, mail, email, admin, help, support, billing, dashboard, static, cdn, m, mcp, dev, staging, test, ns1, ns2, smtp, imap, ftp`, plus a brand and profanity list. Stored in `packages/core/reserved.ts`, shared with key validation (03).

## Routing implementation

1. **Cloudflare DNS:** `shortn.at` A/AAAA → Forge (proxied). `*.shortn.at` → Forge (proxied, wildcard). Explicit records for `app`, `api`, `assets` (R2 custom domain), `status`.
2. **TLS:** Universal SSL covers `shortn.at` and `*.shortn.at` (one level), which is enough for handles. Origin uses a Cloudflare Origin CA wildcard cert with **Full (strict)** mode.
3. **nginx on Forge** (one server block per role):
   - `server_name app.shortn.at` → `web` upstream.
   - `server_name api.shortn.at` → `api` upstream.
   - `server_name shortn.at`:
     - `location = /` and `location ~ ^/(en|pt|es)(/|$)` and prefix list of marketing + `/_next/` → `web`
     - `location ~ ^/[^/]+/?$` (single segment, not matched above) and `^/(qr|b)/[^/]+$` → `redirect`
     - everything else → `web` (404 page)
   - `server_name ~^(?<handle>[a-z0-9-]+)\.shortn\.at$` → `web` with header `X-Shortn-Bio-Handle: $handle`. Next rewrites to `/_bio/[handle]` in `proxy.ts`.
   - `default_server` (any other Host, i.e. custom domains) → `redirect`. The redirect service looks up `domains` by Host: `kind:"links"` resolves keys; `kind:"bio"` or `"both"` on `/` proxies to web as `/_bio/by-domain/{hostname}`.
   - The real-IP config only trusts Cloudflare ranges (03).
4. The list of marketing prefixes lives in **one** generated file (`packages/core/reserved.ts` → `bun run gen:nginx` emits an nginx include), so key validation and routing can't drift apart. Rules for the generator:
   - It only emits exact (`location = /pricing`) or segment-anchored, **case-sensitive** regexes (`~ ^/pricing(/|$)`), never `~*` and never bare prefix `location /pricing`, which would also capture `/pricing2024`.
   - **An existing key always wins.** Legacy reserved only `PUBLIC_PATHS`, case-sensitively, so live keys like `blog`, `docs`, `legal`, `app`, `mcp` or `Pricing` may exist today. Before emitting, the generator queries the DB. A reserved word that collides with a live key is either emitted as an exception routed to `redirect`, or the marketing page moves (e.g. `/docs` → `docs.shortn.at`). M0 #3 lists the collisions and is blocking.
   - QR and bio rules accept a trailing slash (`^/(qr|b)/[^/]+/?$`). Legacy Next 308s `/qr/x/` → `/qr/x`, so that form exists in the wild.
5. **Legacy origins stay alive.** Every origin found in printed QR data (02 M0 #12), such as `www.shortn.at`, `*.vercel.app` or old preview hosts, keeps resolving with the **path preserved** (`return 301 https://shortn.at$request_uri`). For `*.vercel.app`, the Vercel project is kept as a minimal redirect-only deployment and is never deleted.
6. **Per-phase routing table** in 14 decides which upstream owns each path in each phase. In particular, `/b/*`, `/api/*`, `/authenticate/*` and `/{locale}/safety/*` stay on legacy until their replacement ships.

## Bio handles (`{handle}.shortn.at`)

- Created from `bio_pages.handle` (02 §M8). Rules for **new** handles: DNS label, 3–30 chars, `[a-z0-9-]`, no leading or trailing `-`, not reserved, unique. Migrated handles are grandfathered at 1–63 chars.
- Legacy `shortn.at/b/{slug}` → 301 to the page's current handle (via `bio_aliases`, which reference `bioPageId`). Permanent, never removed. This switch happens in P5; until then `/b/*` stays on legacy.
- Changing a handle: the old handle 301s to the page for 30 days. After that it's released only if it never received meaningful traffic. Otherwise it stays retired for that workspace forever, so printed or shared handles can't be taken over.

## Custom domains (paid add-on)

### Flow

1. User adds `go.brand.com` in Settings → Domains (requires the `custom_domains` entitlement, 06).
2. `packages/core/domains.add()` → Cloudflare API `POST /zones/{zone}/custom_hostnames` with `ssl: { method: "http", type: "dv" }`. Store `cfCustomHostnameId`, `status: "pending"`.
3. The UI shows exact DNS instructions: `CNAME go → cname.shortn.at` (our fallback origin hostname). Apex domains need CNAME flattening or an A record to the Cloudflare SaaS anycast IPs, explained per provider with copyable values.
4. A worker job polls the Cloudflare hostname status (backoff 1 min → 1 h, up to 72 h) and moves it to `active` when both hostname and SSL are active. Then it notifies the user.
5. Pick usage: `links` (short links on that domain, `domain` field on links), `bio` (the domain serves a bio page), or `both` (`/` = bio, `/{key}` = links).
6. Removal: delete the custom hostname in Cloudflare. Links on that domain are **not deleted**. They're marked `domainInactive` and remain viewable, exportable and movable to `shortn.at` with one action that keeps the keys if they're free.

### Details

- **Fallback origin:** `cname.shortn.at` → Forge, configured in Cloudflare for SaaS.
- Root `/` of a links-only custom domain → configurable redirect (default: the workspace's bio page or `shortn.at`).
- Per-domain `404` → configurable destination URL.
- Key uniqueness is per domain (`{domain,key}`), so `go.brand.com/sale` and `shortn.at/sale` can coexist.
- Abuse: custom-domain links go through the same safety pipeline. A domain whose links get blocked repeatedly can be suspended (status `suspended`). The CF hostname stays, and the redirect serves the safety page.

## Cookies & security

- Bio subdomains and custom domains serve **only our rendered HTML**. No user scripts or custom HTML blocks (an embed block allows a vetted provider allowlist: YouTube, Spotify, …, via sandboxed iframes).
- Auth cookies are host-only on `app.shortn.at`, so subdomain takeover of a handle can't read sessions. CSP on bio pages: `default-src 'self' assets.shortn.at; frame-src` allowlist.
- HSTS `includeSubDomains; preload` is already set. That's fine, since every subdomain is HTTPS through Cloudflare.

## Acceptance

- `foo.shortn.at` renders the bio page for handle `foo`; `shortn.at/b/foo` → 301 to it.
- A custom domain goes from added to serving HTTPS redirects without manual steps. Deleting it leaves its links intact and recoverable.
- Every legacy URL in a 10k sample from prod (`/key`, `/qr/key`, `/b/slug`) returns the same status and Location via the new routing (14 gate).
