# 20 — Marketing site breakdown (draft)

Status: **in progress.** Accepted as the next phase on 2026-10-17. **M.1 is
complete** ([21](21-marketing-content.md)), and **M.2 (design round) is next**.
Owner decisions D-M1 to D-M4, D-M8, D-M10 and D-M11 are answered (§7). M.1
settled D-M5 and D-M6 (21 §1). D-M7 and D-M9 stay open for M.7 and M.4.

## 1. Scope and why it is its own phase

P4 decision D7 ([16](16-p4-breakdown.md)) took the new marketing site off the
P4 critical path: `/` and `/{locale}/*` stay on legacy "until the marketing
surface has its own impeccable round". No phase owns that round today. P7
(contract, [14](14-cutover-and-rollout.md)) retires the legacy app, and that is
impossible while legacy still serves the root site, its help centre, the
sign-in screens on the root host and `/api/contact`.

Proposal: a **marketing phase (PM)** between P6 and P7. It can be built and
staged in parallel with the P4–P6 production promotions. Its cutover is the "new
marketing on root" step that 14 already places at, or shortly after, the
dashboard default switch.

Plan 14's routing table lists `/`, marketing pages and `/{locale}/*` as **web**
from P4, which contradicts D7. This phase corrects that column: legacy until the
PM cutover.

## 2. Already decided elsewhere

| Decision | Source |
| --- | --- |
| Marketing is a **Persuade**-mode surface with its own impeccable round at Linear/Dub level | [12](12-design-system-and-ui.md) surface table |
| Hero demonstrates the mechanism live: a working shortener creating a real demo link (expires 24 h) and showing the redirect and QR instantly | 12 |
| Real product screenshots only; proof is Vida Económica (with permission) plus a verified click count; no "Supercharge your links with AI" copy | 12 |
| ~~Pricing in EUR~~ USD as billed, with an ECB euro estimate (21 M1-c); pt/es/en | 12 |
| Marketing display face chosen in this round (brief: a heavy grotesque that rhymes with the logo's "S"), not from the dashboard face shortlist; display sizes are marketing-only | 12 type scale |
| Served by apps/web (marketing route group) on `shortn.at` | [07](07-domains-and-subdomains.md) host map, [01](01-monorepo-foundation.md) |
| Locale negotiation happens only on marketing routes, via the Next 16 `proxy` | [05](05-auth-and-workspaces.md) |
| Cloudflare rate limit on the demo shortener; Turnstile on contact, the demo shortener and report forms | [13](13-infra-ops-security.md) |
| `robots.txt` keeps allowing AI crawlers for docs and marketing | [10](10-api-mcp-llms.md) |

## 3. Legacy surface inventory and proposed treatment

All legacy marketing pages live under `/{locale}/…` (`legacy/app/[locale]/(marketing)`).
Unprefixed paths redirect to a locale, and the reserved-key set in
`packages/core/routing.ts` already covers each first segment, so new pages under
`/{locale}/…` cannot collide with short-link keys. **New unprefixed top-level
paths (plan 07 lists `/blog` and `/legal/*`) are not reserved, and live keys may
already use them.** Keep every new page under `/{locale}/` unless a collision
audit says otherwise.

| Legacy path (× en/pt/es) | Pages | Proposed treatment |
| --- | --- | --- |
| `/` → `/{locale}` | home | **Rebuild** (hero demo, proof, features, pricing teaser) |
| `/{locale}/pricing` | 1 | **Rebuild**; plans and prices come from the same plan definitions as the dashboard billing page, never a second copy |
| `/{locale}/products/{url-shortener,qr-code,analytics,pages}` | 4 | **301** to anchors on the single `/{locale}/features` page (D-M4). `/{locale}/products` has no page (404) but is in the sitemap |
| `/{locale}/about`, `/{locale}/contact` | 2 | **Rebuild**; contact backend in M.7 |
| `/{locale}/privacy`, `/{locale}/terms` | 2 (≈1,150 lines of text) | **Port the text verbatim** into the new templates; any wording change needs legal review (D-M6) |
| `/{locale}/abuse` | 1 | **Rebuild** next to the existing web safety/report pages |
| `/{locale}/help`, `/{locale}/help/articles/**` | index + 13 articles | **Move into `/docs`** as user guides, with a 301 from each old article (D-M3) |
| `/{locale}/login`, `register`, `recover`, `reset`, `verify`, `verify/{request-change,requested,sent}`, `auth/error` | 9 | **301 to `app.shortn.at`** equivalents, which already exist in `apps/web/src/app/(auth)`. Preserve the query string: reset/verify links in already-sent emails carry tokens |
| `/{locale}/authenticate/*`, `/{locale}/safety/*` | — | Already served by web since P4; unchanged |
| `/{locale}/[...rest]` | catch-all | Localized 404 |
| `/api/contact` | — | Replace in M.7 |

## 4. Defects in the live site (production, verified 2026-10-17)

These are in today's legacy marketing. The rebuild must not reproduce them.
Per D-M8, legacy is **not** hotfixed; the rebuild's cutover (M.9) is the fix.

1. **Every marketing page canonicalizes to its locale's home page.** The
   `(marketing)` layout sets `alternates.canonical = https://shortn.at/{locale}`
   and no page overrides it. Live: `/en/pricing` → canonical `/en`, `/pt/help`
   → `/pt`, `/en/products/qr-code` → `/en`. Search engines are told that pricing,
   help and product pages are duplicates of the home page.
2. **`robots.txt` is corrupted.** `legacy/public/robots.txt` has two versions
   interleaved within lines (`User-agent: *User-agent: *`,
   `Allow: /Disallow: /dashboard`), and production serves it as-is.
3. **The sitemap is static and wrong.** `legacy/public/sitemap.xml` has 25 URLs. It
   lists `/{locale}/products` (404) and omits the four product pages and all 13
   help articles.
4. No per-page `hreflang` alternates (only the root layout's), no marketing
   analytics at all (only Sentry on the global error page), and no bot protection on
   the contact form beyond a rate limit.

## 5. Slices

| Slice | Required behavior | Verification gate |
| --- | --- | --- |
| **M.1 Content map and copy** | URL map for every legacy marketing URL and sitemap entry (rebuild / 301 target / 404); information architecture; copy deck in en/pt/es; screenshot list from the real dashboard; Vida Económica permission recorded | Every URL in §3 and in the legacy sitemap has a mapped outcome; owner sign-off on copy |
| **M.2 Design round** | Impeccable Persuade round: display face, hero composition, page templates (home, feature, pricing, long-form legal, contact), light/dark, mobile | Approved review artifacts at 390 px and desktop in both themes; `12` updated with the chosen face |
| **M.3 Marketing shell** | `(marketing)` route group in apps/web on the root host under `/{locale}/…`; shared header/footer; proxy locale negotiation (05) without touching dashboard routes; one metadata helper giving each page a **self-canonical URL and reciprocal hreflang**; generated `sitemap.ts` from the route list; one `robots.ts` covering marketing, docs and llms (10); OG images per page | Unit tests for the metadata helper; a crawl of staging where every sitemap URL returns 200, is self-canonical, and has reciprocal hreflang for en/pt/es and `x-default` |
| **M.4 Pages** | Home, pricing (single plan source), feature pages (D-M4), about, abuse, privacy/terms ported verbatim | Lighthouse mobile ≥ 95 for performance, accessibility and SEO on home and pricing; no layout overflow at 390 px; copy matches M.1 |
| **M.5 Demo shortener** | Anonymous create behind Turnstile and the Cloudflare rate-limit rule; global daily cap; destination safety scan **before** the link resolves; random non-vanity keys only; 24 h expiry and the key stays reserved afterwards (reuses P6 trash/reserved-key logic); instant QR via the existing renderer; demo links excluded from any workspace and from analytics beyond a count; abuse-report link on the result | Abuse tests (blocked destination, rate limit, Turnstile failure, cap); expiry and reservation tested; rate-limit rule exercised on staging |
| **M.6 Help → docs** | The 13 help articles become user guides under `/docs` (apps/web `docs/[[...slug]]`, `packages/docs`), so they also land in `llms.txt`; 301 from each `/{locale}/help/...` path | Every old help URL 301s to a 200 guide; the docs drift check passes |
| **M.7 Contact** | Form with Turnstile and rate limit; storage stays compatible with what the admin console reads (D-M7); confirmation email via `packages/emails`; owner notification | Submission stored and both emails delivered on staging (allowlisted recipient) |
| **M.8 Auth-screen redirects** | 301s from root-host auth screens to `app.shortn.at`, preserving path, locale and query | Token-bearing reset/verify links from real legacy emails land on working app screens |
| **M.9 Cutover** | Edge routes `/` and `/{locale}/*` (excluding the dashboard handoff path) to web, with the existing fall-back-to-legacy-on-5xx; staging first, then production; new sitemap submitted to Search Console | Every mapped URL returns its mapped outcome through the production edge; Search Console coverage watched for 14 days with no unexplained drop; rollback exercised by removing the marketing paths from the Worker routing |

Order: M.1 → M.2 → M.3, then M.4–M.8 in parallel, then M.9. M.5 is the riskiest
piece of new backend. Its abuse controls must be accepted before the hero ships
with it; until then the hero can link straight to sign-up.

## 6. Exit gate

All mapped legacy marketing URLs resolve to their mapped outcome (200 or a single
301 hop) through the production edge. No URL from the old sitemap 404s. Pages are
self-canonical with reciprocal hreflang. The demo shortener's abuse controls are
verified. Search Console coverage is stable for 14 days after cutover. Legacy serves
no marketing, help or root-host auth page, which removes those items from the P7
blocker list.

## 7. Decisions

| # | Decision | Outcome / options |
| --- | --- | --- |
| D-M1 | Phase placement | **Decided 2026-10-17:** the next phase after P6, before P7, built on staging alongside the production promotions |
| D-M2 | Copy ownership | **Decided 2026-10-17:** the implementer writes and approves the en/pt/es copy in M.1; the owner does a second review afterwards. Each language is written natively, not machine-translated |
| D-M3 | Help centre | **Decided 2026-10-17:** fold into `/docs` as user guides (one place, already in llms.txt), with 301s from every old help URL |
| D-M4 | Feature pages | **Decided 2026-10-17:** one `/{locale}/features` page with anchors; the four product pages 301 to them (21 §2.1) |
| D-M5 | Blog | **Settled in M.1:** no blog in PM; add `/{locale}/blog` later if there is a content plan |
| D-M6 | Legal text | **Settled in M.1:** port privacy, terms and abuse verbatim in English under every locale, with a localized notice; the review items in 21 §8 do not block the port |
| D-M7 | Contact backend | Keep writing the legacy `Contact` collection so the admin console (`admin.shortn.at`, separate repo) keeps working, or move to a new collection plus email-to-inbox and update the console |
| D-M8 | Legacy SEO hotfix | **Decided 2026-10-17:** no legacy hotfix. §4.1–4.3 stay live until the M.9 cutover, so M.9 is also the SEO fix |
| D-M9 | Marketing analytics | None today. Options: none; cookieless self-hosted (e.g. Plausible/Umami on the existing infra); or Shortn's own click pipeline for CTA links. Any choice must fit the privacy policy text |
| D-M10 | Demo link domain | **Decided 2026-10-17:** real `shortn.at` keys, random non-vanity only, reserved after the 24 h expiry. The M.5 abuse controls are therefore mandatory before launch, because demo links share the main domain's reputation |
| D-M11 | Vida Económica proof | **Decided 2026-10-17:** the owner granted permission to use all Vida Económica statistics (name and figures; not their logo or a quotation). Figures and method in 21 §5 |

## 8. P7 items this phase does not cover

Legacy also still serves `/api/handoff`, `/api/polar/*`, `/api/cron/*`,
`/api/track-click`, `/b/*` until the P5 301s, and the shared tables the admin
console reads. P7's own checklist must close those; PM removes only the
marketing, help, contact and root-host auth surfaces.
