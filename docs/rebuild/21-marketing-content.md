# 21 — Marketing content map and copy (slice M.1)

Status: **M.1 complete, 2026-10-17.** This document records the M.1 deliverables
from [20](20-marketing-breakdown.md) §5: the URL map, the information
architecture, the copy deck, the screenshot list and the Vida Económica proof
record. Under D-M2, the implementer wrote and approved the copy. The owner's
second review is still pending and does not block M.2.

The copy deck is the `marketing` message namespace:

- `apps/web/messages/en/marketing.json`
- `apps/web/messages/pt/marketing.json` (European Portuguese, impersonal register)
- `apps/web/messages/es/marketing.json` (Spain Spanish, `tú`)

Each language was written natively, not translated string by string. The
catalogs are registered in each locale's `index.ts`. As a result,
`src/i18n/messages.test.ts` enforces key parity and identical ICU arguments
across the three languages. M.4 builds pages from these keys; any wording change
happens in the JSON, not in page code.

## 1. Decisions taken in M.1

| #     | Decision                                                                                                                                                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-M4  | **Owner decision, 2026-10-17: one features page.** `/{locale}/features` with eight anchored sections (§3.2). The four legacy product pages 301 to their anchors.                                                                                                                                                                                                       |
| D-M11 | **Owner decision, 2026-10-17: permission to use all of Vida Económica's statistics.** The permission covers the name and the figures in §5. It does not cover their logo or a quotation. Neither exists in the deck, and both need a separate request before M.4 adds them.                                                                                            |
| D-M5  | No blog in this phase, as recommended in 20. No `/blog` link anywhere in the deck.                                                                                                                                                                                                                                                                                     |
| D-M6  | Port privacy, terms and the abuse policy verbatim, in English, in every locale, with a localized notice that the English text applies (`marketing.legal.authoritative`, `marketing.abuse.authoritative`). Legacy already serves English-only legal text under every locale, so this is not a regression. §8 lists the legal review items, which do not block the port. |
| M1-a  | Help guides move to `/docs/{locale}/guides/{path}`, keeping all three languages. Guides are localized; the API reference at `/docs/{slug}` stays English. `en`, `pt` and `es` cannot collide with an API doc slug.                                                                                                                                                     |
| M1-b  | `/{locale}/help/articles/billing/plans-pricing` 301s to `/{locale}/pricing`, not to a guide. Plans stay in one source (the catalog), not in a fourth copy.                                                                                                                                                                                                             |
| M1-c  | Prices are shown **in US dollars with a euro estimate**, matching what checkout bills (`packages/billing/catalog.ts` `priceUsdMonthly`; `billing.json` "Checkout is billed in USD"). This corrects plan 12's "pricing in EUR" and the PRODUCT.md positioning line. Showing euro prices that checkout does not charge would be a dark pattern.                          |
| M1-d  | The proof shows rounded-down figures (§5).                                                                                                                                                                                                                                                                                                                             |
| M1-e  | Root-host auth screens 301 to the app host and set `NEXT_LOCALE={locale}; Domain=shortn.at`. The app's `resolveLocale` already reads that cookie (`apps/web/src/i18n/locale.ts`), so the visitor keeps their language without any app change.                                                                                                                          |

## 2. URL map

`{l}` is each of `en`, `pt` and `es`, so every row covers three URLs. "App" means
`https://app.shortn.at`. Every 301 preserves the query string, and each row
resolves in a single hop.

### 2.1 Marketing pages

| Legacy URL                                  | Outcome                      | Target                                     |
| ------------------------------------------- | ---------------------------- | ------------------------------------------ |
| `/`                                         | 302 (locale negotiation, 05) | `/{l}`                                     |
| `/{l}`                                      | **Rebuild**                  | home                                       |
| `/{l}/pricing`                              | **Rebuild**                  | pricing                                    |
| `/{l}/products` (404 today, in the sitemap) | 301                          | `/{l}/features`                            |
| `/{l}/products/url-shortener`               | 301                          | `/{l}/features#links`                      |
| `/{l}/products/qr-code`                     | 301                          | `/{l}/features#qr-codes`                   |
| `/{l}/products/pages`                       | 301                          | `/{l}/features#bio-pages`                  |
| `/{l}/products/analytics`                   | 301                          | `/{l}/features#analytics`                  |
| — (new)                                     | **New**                      | `/{l}/features`                            |
| `/{l}/about`                                | **Rebuild**                  | about                                      |
| `/{l}/contact`                              | **Rebuild** (backend M.7)    | contact                                    |
| `/{l}/abuse`                                | **Port verbatim**            | abuse policy                               |
| `/{l}/privacy`                              | **Port verbatim**            | privacy policy                             |
| `/{l}/terms`                                | **Port verbatim**            | terms                                      |
| `/{l}/{anything else}`                      | 404                          | localized not-found (`marketing.notFound`) |

Fragments are not sent to the server, so the four product 301s carry the
fragment in the `Location` header itself. Browsers keep it.

### 2.2 Help centre (moved in M.6)

| Legacy URL                                             | 301 target                                           |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `/{l}/help`                                            | `/docs/{l}/guides`                                   |
| `/{l}/help/articles/getting-started`                   | `/docs/{l}/guides/getting-started`                   |
| `/{l}/help/articles/links/creating-links`              | `/docs/{l}/guides/links/creating-links`              |
| `/{l}/help/articles/links/managing-links`              | `/docs/{l}/guides/links/managing-links`              |
| `/{l}/help/articles/links/utm-parameters`              | `/docs/{l}/guides/links/utm-parameters`              |
| `/{l}/help/articles/qr-codes/creating-qr-codes`        | `/docs/{l}/guides/qr-codes/creating-qr-codes`        |
| `/{l}/help/articles/qr-codes/managing-qr-codes`        | `/docs/{l}/guides/qr-codes/managing-qr-codes`        |
| `/{l}/help/articles/bio-pages/creating-bio-pages`      | `/docs/{l}/guides/bio-pages/creating-bio-pages`      |
| `/{l}/help/articles/bio-pages/customizing-bio-pages`   | `/docs/{l}/guides/bio-pages/customizing-bio-pages`   |
| `/{l}/help/articles/campaigns/organizing-campaigns`    | `/docs/{l}/guides/campaigns/organizing-campaigns`    |
| `/{l}/help/articles/analytics/understanding-analytics` | `/docs/{l}/guides/analytics/understanding-analytics` |
| `/{l}/help/articles/billing/upgrading-plans`           | `/docs/{l}/guides/billing/upgrading-plans`           |
| `/{l}/help/articles/billing/plans-pricing`             | `/{l}/pricing` (M1-b)                                |
| `/{l}/help/{anything else}`                            | `/docs/{l}/guides`                                   |

The legacy articles describe the legacy dashboard. M.6 rewrites each one against
the rebuilt UI rather than porting the text.

### 2.3 Root-host auth screens (M.8)

| Legacy URL                                  | 301 target                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/{l}/login`                                | App `/login`                                                                                                                                                                                                                                     |
| `/{l}/register`                             | App `/register`                                                                                                                                                                                                                                  |
| `/{l}/recover`                              | App `/recover`                                                                                                                                                                                                                                   |
| `/{l}/reset`                                | App `/reset` (`?token=` from already-sent emails must survive)                                                                                                                                                                                   |
| `/{l}/verify`                               | App `/verify`                                                                                                                                                                                                                                    |
| `/{l}/verify/sent`, `/{l}/verify/requested` | App `/verify`                                                                                                                                                                                                                                    |
| `/{l}/verify/request-change`                | App email-change confirmation. Legacy emails carry a better-auth `changeEmail` token (`legacy/lib/auth.ts:138-140`) from the shared database. M.8 adds an app route that confirms it, or maps it to an existing one. It must not drop the token. |
| `/{l}/auth/error`                           | App `/login` (keep `?error=`)                                                                                                                                                                                                                    |
| `/{l}/authenticate/*`, `/{l}/safety/*`      | Unchanged; web has served them since P4                                                                                                                                                                                                          |

### 2.4 Legacy sitemap coverage

All 25 URLs in `legacy/public/sitemap.xml` are mapped: `/` (§2.1 row 1); `/{l}`,
`/{l}/pricing`, `/{l}/about`, `/{l}/contact`, `/{l}/privacy` and `/{l}/terms`
(rebuilt or ported); `/{l}/products` (301); `/{l}/help` (301). None of them 404
after cutover.

### 2.5 New sitemap (generated in M.3)

Every listed URL carries a self-canonical and reciprocal hreflang for
`en`/`pt`/`es`, plus `x-default` → `/en/...`:

`/{l}`, `/{l}/features`, `/{l}/pricing`, `/{l}/about`, `/{l}/contact`,
`/{l}/abuse`, `/{l}/privacy`, `/{l}/terms` (24 URLs), plus `/docs/{l}/guides`
(3 URLs; M.6 adds the 11 guides × 3) and the English `/docs` index. 301 sources
never appear in the sitemap.

## 3. Information architecture

### 3.1 Global

- **Header:** logo (home), Features, Pricing, Docs, then Sign in and **Start for
  free**, aligned right. Below the desktop breakpoint, the links collapse into a
  full-width in-page menu (`nav.openMenu`/`closeMenu`). There is no mega-menu:
  with one features page, a single link replaces the legacy products dropdown.
- **Footer:** four columns.
  - Product: Features, Pricing, Docs.
  - Company: About, Contact.
  - Resources: Guides, API reference, Status, Report a link.
  - Legal: Privacy, Terms, Abuse policy.

  A language switcher sits below the columns. Each option links to the same page
  in the other locale, not to its home page.

- **Sign in** goes to App `/login`. **Start for free** goes to App `/register`.

### 3.2 Pages and section order

| Page                  | Sections (deck keys under `marketing.`)                                                                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | `home.hero` with `home.demo` as the hero's working mechanism (M.5; until its abuse controls pass, the hero shows `hero.primary` only, per 20), then `home.proof`, `home.print`, `home.manage`, `home.analytics`, `home.developers`, `home.pricing`, `home.cta`                          |
| Features              | `features.title`/`intro`, an in-page contents list (`features.toc`), then eight sections in this order. Anchor ids are stable and must not be localized: `#links`, `#qr-codes`, `#bio-pages`, `#campaigns`, `#analytics`, `#teams`, `#developers`, `#safety`. Ends with `features.cta`. |
| Pricing               | `pricing.title`/`intro`, five plan columns rendered from `plans` in `packages/billing/catalog.ts` (limits through `pricing.limits.*` with the catalog's numbers, never hard-coded), `currencyNote`, `compare` table from `features`, `addon`, `faq`                                     |
| About                 | `about.title`/`intro`, `about.principles` (4), `about.languages`, `about.cta` → contact                                                                                                                                                                                                 |
| Contact               | `contact.title`/`intro`, the `contact.abuse` redirect to `/safety/report`, then the form (`contact.form`, M.7)                                                                                                                                                                          |
| Abuse, Privacy, Terms | Verbatim English body, `legal.updated`, `legal.contents`, and the `authoritative` notice in pt/es                                                                                                                                                                                       |

The home page answers three questions in order: what the product does (hero),
whether to trust it (proof, placed immediately after the hero), and whether it
fits print and digital work (print, manage, analytics, developers). The pricing
teaser and the final CTA close the page. The recommended plan on pricing is
**Pro**, the plan the reference customer profile needs. The label says
"Recommended", not "Most popular", because no data supports a popularity claim.

### 3.3 Dynamic values

| Argument                                                    | Source                                                                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home.pricing` `{links}`, `{qrCodes}`, `{price}`            | `plans.free.limits` and the cheapest paid `priceUsdMonthly`, formatted for the locale                                                                                        |
| `pricing.perMonth` `{price}`, `pricing.eurEstimate` `{eur}` | Catalog USD plus the cached ECB rate (`packages/billing/exchange-rate.ts`, `billingFormat`). When the rate is unavailable, hide the estimate rather than showing a stale one |
| `home.proof` figures, `{month}`, `{date}`                   | §5 constants in one module, with the measurement date                                                                                                                        |
| `footer.copyright` `{year}`                                 | Build year                                                                                                                                                                   |
| Custom-domain add-on price                                  | The Polar product (`POLAR_DOMAIN_PRODUCT_ID`), read at render time. The deck states no price because the repo does not hold one                                              |

## 4. Fact sheet

Every product claim in the deck, with its source. M.4 may not add a claim that
is not in this table.

| Claim                                                                                                                               | Source                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Monthly creation limits, seats, workspaces, history and API rates per plan; Pro unlimited; Enterprise custom                        | `packages/billing/catalog.ts` `plans`                                         |
| Feature gates (custom keys, passwords, campaigns, breakdowns, CSV, QR logo, API, MCP)                                               | Same file, `features`; SSO is Enterprise (`packages/auth/enterprise-sso.ts`)  |
| Billed in USD, ECB euro estimate                                                                                                    | `billing.json` `priceEstimate` and `note`; `exchange-rate.ts`                 |
| Expiry, schedule, click limits, fallback, device/geo targeting, rotation, deep links, query/UTM forwarding                          | 19 §6.8                                                                       |
| Title/key suggestions, bulk tags/campaign/archive/export/delete, cross-page selection, 30-day trash, reserved keys                  | 19 §6.9                                                                       |
| SVG/PNG/PDF QR exports, print guidance, frames/captions/logo, ZIP of a selection                                                    | 19 §6.9                                                                       |
| Bio blocks, embeds, constrained themes, drafts, scheduling, last 20 versions, handles, custom domains as an add-on                  | 18 §5.1-5.5                                                                   |
| Roles owner/admin/member/viewer                                                                                                     | `packages/db/schemas/index.ts:237`                                            |
| Two-factor, passkeys, SAML/OIDC                                                                                                     | 19 §6.10                                                                      |
| CSV import up to 50,000 rows; workspace export                                                                                      | 19 §6.6, §6.7                                                                 |
| REST + OpenAPI, scoped keys, signed webhooks (mutations, clicks, scans, publishing), MCP with per-workspace OAuth consent, llms.txt | 19 §6.1-6.5                                                                   |
| IP addresses hashed; raw addresses deleted after 90 days                                                                            | `ipHash` on click events; `v2_ip_ttl` TTL index, `packages/db/indexes.ts:359` |
| Three reports switch a link off                                                                                                     | `packages/core/links/public.ts:227-241` (`auto:report-threshold`)             |
| Destination safety checks and the warning page                                                                                      | `public.json` `safety`; link `safety` fields                                  |
| Existing links keep redirecting on any plan                                                                                         | Plan limits gate creation only (`PlanLimits` comment in the catalog)          |
| Started in 2023 for Vida Económica                                                                                                  | First workspace link 2023-08-30 (§5)                                          |

### 4.1 Legacy claims dropped

Legacy made these claims; the deck drops them. Each one is unverifiable or
false.

| Legacy copy                                                      | Reason                                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| "85% cheaper than competitors", "85% lower prices"               | No maintained comparison                                                                                                                         |
| "99% / 99.9% uptime SLA"                                         | No SLA exists in the terms                                                                                                                       |
| "5K+ links shortened", "35+ countries"                           | Stale; country counts are inflated by crawlers (§5.2)                                                                                            |
| "Join thousands of marketers"                                    | 36 production users                                                                                                                              |
| "Sub-100ms redirects with our global edge network", "Global CDN" | Not measured or published; plan 03 has targets, not results                                                                                      |
| "Built with feedback from hundreds of users"                     | Unverifiable                                                                                                                                     |
| "Your data is encrypted"                                         | Too vague; replaced by the specific hashing and retention claim                                                                                  |
| README "2.4M+ clicks"                                            | **False.** Production holds 165,255 counted clicks across the whole platform (§5). Fix README and PRODUCT.md (done in this slice for PRODUCT.md) |

## 5. Vida Económica proof record

### 5.1 Figures

Measured 2026-10-17 from production database `proj_shortn_v2`, workspace
`6ac9c295ca4f1e51c616f1d4` (owner account `marketing@grupovidaeconomica.pt`),
using read-only aggregations.

| Figure                      | Measured   | Shown (M1-d) | Definition                                                                   |
| --------------------------- | ---------- | ------------ | ---------------------------------------------------------------------------- |
| Clicks and scans counted    | 164,900    | **160,000+** | Sum of the legacy per-link counter `clicks.total` over the workspace's links |
| Short links created         | 2,683      | **2,600+**   | Links in the workspace                                                       |
| QR codes created            | 542        | **540**      | `qrcodesv2` in the workspace (equals the `isQrCode` link count)              |
| QR scans since January 2026 | 14,352     | **14,000+**  | `click_events` with `kind: "scan"`; scan attribution began 2026-01-14        |
| Customer since              | 2023-08-30 | **2023**     | Earliest `createdAt` in the workspace                                        |

Recompute with the same definitions before each launch and update the module
constants and `{date}` together.

### 5.2 What the proof does not claim

- **Countries.** Events show 132 countries, but the Netherlands (7,095) and
  Ireland (5,883) rank second and third, behind Portugal (15,048). That pattern
  matches link scanners at mail and cloud providers, not readers, and the `bot`
  flag does not catch them. A country claim would overstate reach.
- **Platform-wide totals.** Vida Económica accounts for 2,683 of the 2,734
  production links and 164,900 of the 165,255 counted clicks. A "platform"
  figure would be the same number presented as broader adoption.
- **Description of the customer.** The deck says "Portuguese business
  publisher". It does not repeat the README's "Portugal's leading". The uses
  named (website, online bookshop, printed agendas) are taken from the
  workspace's most-clicked links.

## 6. Screenshot list (captured in M.2 from staging)

Capture each screenshot in light and dark mode, at desktop width and 390 px,
from a staging workspace seeded with realistic data. Never use Vida Económica's
workspace, whose destinations and titles are theirs.

1. Links list with 2,000+ links, tag filter applied and a cross-page selection
   count visible (`/[workspace]/links`): home "manage", features `#links`.
2. Link analytics with a 90-day range and country/device breakdowns
   (`/links/[id]/analytics`): home "analytics", features `#analytics`.
3. Link edit with rules (schedule, device targeting, rotation) open
   (`/links/[id]/edit`): features `#links`.
4. QR design with a frame and caption, plus the print guidance panel
   (`/qr/[id]/design`, `/qr/[id]/export`): home "print", features `#qr-codes`.
5. Bio editor with the live preview (`/bio/[id]/editor`): features `#bio-pages`.
6. Public bio page on a phone (390 px, handle host): features `#bio-pages`.
7. Campaign analytics (`/campaigns/[id]/analytics`): features `#campaigns`.
8. Members with roles, and SSO settings (`/settings/members`,
   `/settings/sso`): features `#teams`.
9. API keys with scopes, and the webhook delivery log (`/settings/api-keys`,
   `/settings/webhooks/[id]`): home "developers", features `#developers`.
10. Import mapping and review (`/imports/new`): features `#teams`.
11. Safety interstitial (`/safety/[key]`): features `#safety`.

## 7. Terminology

| en                       | pt-PT                             | es-ES                              |
| ------------------------ | --------------------------------- | ---------------------------------- |
| link, short link         | link, link curto                  | enlace, enlace corto               |
| key                      | chave                             | clave                              |
| QR code                  | código QR                         | código QR                          |
| click / scan             | clique / leitura                  | clic / escaneo                     |
| bio page, handle         | página bio, nome                  | página bio, nombre                 |
| campaign, tag            | campanha, etiqueta                | campaña, etiqueta                  |
| workspace, member, seat  | espaço de trabalho, membro, lugar | espacio de trabajo, miembro, plaza |
| add-on                   | extra                             | complemento                        |
| analytics                | estatísticas                      | estadísticas                       |
| passkey                  | chave de acesso                   | llave de acceso                    |
| Sign in / Start for free | Iniciar sessão / Começar grátis   | Iniciar sesión / Empezar gratis    |

Plan names (Free, Basic, Plus, Pro, Enterprise) are product names and are not
translated. These terms match the dashboard catalogs.

## 8. Constraints handed to later slices

- **M.9 precondition:** the features page describes P4-P6 functionality that
  production does not serve yet; production is still legacy plus the P2
  redirect. Do not cut over marketing before the P4-P6 production promotion
  and its per-feature rollouts reach 100%. Otherwise, remove the affected points
  for the launch.
- **Data location:** the deck makes no hosting-location claim. PRODUCT.md
  positions Shortn as "EU-hosted", but no record in this repo states where the
  data lives. Add a location claim only with that record.
- **Legal review items (D-M6), which do not block the verbatim port.** The
  privacy policy is dated 2025-12-22, before the rebuild. Check it against:
  - IP hashing and the 90-day raw-IP retention;
  - the /24 IP prefix kept on click events;
  - Cloudflare Turnstile on the demo shortener and contact form;
  - any marketing analytics (D-M9).
- **D-M7** (contact storage) and **D-M9** (marketing analytics) stay open for
  M.7 and M.4.
- **Display copy length.** Portuguese and Spanish headlines run up to 40%
  longer than English (`home.proof.title`: en 41, pt 56, es 57 characters). M.2 templates must fit the
  longest of the three at 390 px without truncation.

## 9. Gate

| Gate (20 §5)                                                      | Evidence                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Every URL in 20 §3 and in the legacy sitemap has a mapped outcome | §2.1-2.4: 36 legacy routes × 3 locales, and all 25 sitemap URLs |
| Information architecture                                          | §3                                                              |
| Copy deck in en/pt/es                                             | `marketing.json` × 3; parity and ICU tests pass                 |
| Screenshot list                                                   | §6                                                              |
| Vida Económica permission recorded                                | D-M11 (§1), figures and method (§5)                             |
| Owner sign-off on copy                                            | D-M2: the implementer approved; owner second review pending     |
