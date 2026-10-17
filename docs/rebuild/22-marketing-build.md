# 22 — Marketing build record (slices M.2–M.9)

Status: **M.2–M.8 built and on `staging`; M.9 staging cutover done.**
Production is untouched. Its cutover needs the P4–P6 production promotion
(21 §8) and explicit owner authorization. This record follows
[20](20-marketing-breakdown.md) §5 and lists each slice's gate evidence.

## 1. Architecture

| Concern | Implementation |
| --- | --- |
| Routing | The pages live at `apps/web/src/app/%5Fmarketing/[locale]/…` (URL `/_marketing/{l}/…`). `[workspace]` owns the first dynamic segment, and `en`/`pt`/`es` are reserved workspace slugs, so the proxy rewrites `/{l}/…` to the internal tree. Visiting `/_marketing` directly returns 404 |
| Route table | `apps/web/src/lib/marketing/routes.ts`: pages, the product 301s to anchors, the help 301s to guides, the auth 301s to the app host (21 §2). The proxy, the sitemap and the acceptance script all read it |
| Locale | The proxy forwards the URL locale in `x-shortn-locale` (and strips that header from every other request). `i18n/request.ts` reads it, so `<html lang>` and every catalog follow the URL. `/` on the root host returns a 302 to `/{l}` from the cookie or `Accept-Language` |
| SEO | `lib/marketing/seo.ts` gives every page a self-canonical URL, reciprocal `en`/`pt`/`es` hreflang plus `x-default` (English), and `index, follow`. `app/sitemap.ts` is generated from the route table: 24 page URLs, 36 guide URLs and `/docs`. `robots.ts` points to the sitemap. OG images: `/{l}/og/{page}`, set in Schibsted Grotesk |
| Edge (M.9) | Worker flag `MARKETING_ENABLED=1` sends `/`, `/{l}/*` and `/sitemap.xml` to web. It runs after the dashboard handoff and keeps the existing fall-back to legacy on any 5xx. A Workers rate limiter (`FORM_RATE_LIMITER`, 10/min per IP) guards demo and contact posts. Removing the flag is the rollback |
| Assets | Next static assets come from `WEB_ASSET_ORIGIN` (unchanged). Product screenshots are static imports rendered as plain `<img>`, because the root host does not route `/_next/image` |

## 2. Slices

### M.2 Design round

- Mode Persuade. The world is set by the PRODUCT.md commitment (category
  standard at Linear/Dub craft). The surface seed `4ea5edc6` dealt the
  proof-led structure. The direction contract is in
  `apps/web/.impeccable/surfaces/apps-web-src-app-5fmarketing-locale-page-tsx.md`.
  The run was unattended (owner goal 2026-10-17), so it adopted the dealt
  lead without a decision page.
- Display face: **Schibsted Grotesk 800** (12 updated). Navy `.band` fields
  remap the tokens for the page head, proof and close bands. Reading bands are
  white or dark navy, separated by hairlines.
- Signature interaction: the demo link object. The key writes itself in and
  the QR code resolves top to bottom. Reduced motion skips both.
- Review artifacts: `.impeccable/review/pm-marketing/`, 15 captures (1440
  and 390 px, light and dark, en/pt/es); the detector run; the finish review.
- Product screenshots: 12 captures × 2 themes from a seeded loopback sandbox
  (`bun run shots:marketing`), with the fictional publisher "Atlântico Media".
  No customer data (21 §6).

- Finish review (`finish-review.md`): first disposition **fix**, with 8 material items.
  The verdict pass resolved 5 and left 2 partial and 1 unresolved. Two more were
  fixed after it: one sample-data caption per page, and a scroll hint on the
  390 px compare table. **Open polish, outside the two-round unattended
  budget:**
  - the screenshot generator still shows test-like data in places ("Device
    target 1" rule names, every link created on one day, numeric slug
    suffixes);
  - section-specific 1:1 crops instead of whole downscaled screens;
  - a marked "priced at checkout" line for the domain add-on.

### M.3 Shell

Header (in-page mobile menu, no sheet), footer (four columns plus a language
switcher that links to the same page), localized 404, metadata helper,
sitemap, robots, OG route. Unit tests: `lib/marketing/routes.test.ts` (routing
and SEO helpers).

### M.4 Pages

Home, features (8 stable anchors), pricing, about, contact, abuse, privacy
and terms. Copy comes only from `marketing.json`.

- Pricing is rendered from `packages/billing/catalog.ts`. The euro estimate
  is shown only when the ECB rate is under 7 days old.
- Legal text is ported verbatim from legacy by script into
  `components/marketing/legal/*.tsx`, with English `lang` on the body and a
  localized notice in pt/es.

Copy changes in M.4:

- "Keys never reused" was replaced in all three locales (home manage, features
  `#links`, about). Purged keys *are* freed after the 30-day trash, and the P6
  test `trash.integration.test.ts` asserts it. The copy now says what is true:
  a deleted link keeps its key for 30 days. **Owner decision pending:**
  tombstoning purged keys would make the stronger claim true.
- The footer drops "Status": the status page has no Shortn service.
- "Report a link" goes to `/{l}/abuse#report`. The form there resolves a short
  link and opens its safety page, where reports are filed. The deck's
  `/safety/report` target does not exist.
- The custom-domain add-on states no price. The deck states none, and the
  dashboard shows none either.
- D-M9 (analytics): none.

### M.5 Demo shortener

- Core: `packages/core/links/demo.ts`. URL validation; refusal of Shortn's own
  hosts; the structural, Web Risk and domain-age scan **before** insert (only
  `safe` passes); random 8-character keys on the main domain; no workspace;
  `rules.expiresAt` = 24 h; `maxClicks` 200.
- `toCachedLink` marks `demo` links `untracked`. The redirect counts them only
  for the cap and writes no click events. The document is never purged, so the
  key stays reserved.
- Web: `POST /{l}/demo`, in this order:
  1. origin check;
  2. Turnstile;
  3. 5 per 10 min and 20 per day for each IP HMAC;
  4. global daily cap (`MARKETING_DEMO_DAILY_CAP`, default 300).
- Edge: the Workers rate limiter.
- Switch: the hero shows the demo only with `MARKETING_DEMO_ENABLED=1` and
  both Turnstile keys; otherwise it shows the sign-up CTA.
- Tests:
  - `demo.integration.test.ts`: untracked, capped, expires, key kept, unsafe
    and self-referencing destinations refused;
  - `e2e/marketing.local.ts`: origin, invalid, challenge failure, blocked,
    per-visitor limit, daily cap, stored shape;
  - edge test: rate limiter returns 429.
- **Production precondition:** set `WEB_RISK_API_KEY` on the production web
  target. Staging scans are structural and domain-age only.

### M.6 Help → docs

`docs/guides/{en,pt,es}/**`: an index plus 11 guides per locale, written
against the rebuilt dashboard. `generate-docs.ts` builds them into
`packages/docs/generated.json` at `/docs/{l}/guides/{path}`, so they appear in
`llms.txt`. Guide pages carry `lang`, a canonical URL and reciprocal hreflang.
Every legacy help URL returns a single 301 (`/{l}/help/articles/billing/plans-pricing`
goes to pricing, M1-b).

### M.7 Contact

D-M7: the form writes legacy `contacts` in mongoose shape (`CT-YYYYMMDD-XXXXX`).
`ipAddress` stores the visitor's HMAC. The visitor gets a confirmation email
(`contactReceived`) and `CONTACT_INBOX` gets a notification with `replyTo`. The
form has Turnstile, a honeypot, and limits of 3 per 10 min and 10 per day per
IP HMAC.

### M.8 Auth-screen redirects

`/{l}/login|register|recover|reset|verify|verify/sent|verify/requested|auth/error`
301 to the app host with the query string intact. They set
`NEXT_LOCALE={l}; Domain=shortn.at`. Legacy `verify/request-change?token=…`
301s to the app's `/api/auth/verify-email?token=…&callbackURL=/verify`, the
same endpoint the app's own change-email mails use.

### M.9 Cutover

Staging only:

- `MARKETING_ENABLED=1` and the rate limiter in `[env.staging]`;
- deployed with `bun run --cwd apps/edge deploy:staging`.

Production `wrangler.toml` vars are unchanged; the flag is documented there
as a comment.

## 3. Production checklist (not done; owner authorization required)

1. Promote P4–P6 to production and reach 100% (21 §8).
2. On the production web target:
   - Set `PUBLIC_ORIGIN=https://shortn.at`, `WEB_RISK_API_KEY`, a production
     Turnstile widget for `shortn.at` and `app.shortn.at`, and
     `CONTACT_INBOX`.
   - Set `MARKETING_DEMO_ENABLED=1` only after reviewing staging abuse logs.
3. Add `MARKETING_ENABLED = "1"` and the `ratelimits` block to the production
   Worker config, then `bun run --cwd apps/edge deploy`.
4. Run `MARKETING_ORIGIN=https://shortn.at bun --no-env-file apps/web/e2e/marketing.local.ts`.
   Submit the sitemap in Search Console and watch coverage for 14 days.
5. Rollback: remove `MARKETING_ENABLED` and redeploy the Worker. Legacy still
   serves every path.
