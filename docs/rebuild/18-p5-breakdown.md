# 18 — P5 task breakdown

P5 delivers the new public bio renderer, bio subdomains and custom domains described in [07](07-domains-and-subdomains.md), [08](08-link-in-bio.md) and [14](14-cutover-and-rollout.md).

## Entry checkpoint — 2026-10-11

P4 has been integrated into staging for acceptance. Its production exit gate remains open as recorded in [16](16-p4-breakdown.md). P5 development can proceed from staging while those checks run. P4 production promotion and switches remain gated separately.

## Implementation slices

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| 5.1 | Public renderer for typed blocks, constrained themes/presets, shared editor preview and internal handle route | Empty, short and 20+ link pages; long titles; links with/without images; desktop/mobile; en/pt/es glyph coverage; accessible contrast and keyboard interaction. Preserve migrated content and legacy fonts. |
| 5.2 | Draft/publish/version services, block editing and scheduling, inline URL shortening | Permission/entitlement checks; stable block IDs; atomic publish; restore from last 20 versions; failed saves retain drafts. Published content and preview use the same renderer. |
| 5.3 | Handle resolution, aliases and edge host routing; gated `/b/{slug}` redirects | Reserved labels and grandfathered handles; old aliases resolve to the current page; host headers are authenticated at the origin; staging uses its documented single-level hosts. Exhaustive legacy slug redirect comparison. |
| 5.4 | Cached public delivery, invalidation, SEO/OG and bio view analytics | Publish invalidates origin/edge caches; canonical handle/custom domain; noindex; isolated view ingestion; tracked link clicks; consent-gated embeds; minimal client JavaScript. |
| 5.5 | Custom-domain entitlement/add-on, provider adapter, polling jobs and Settings → Domains | Pending/active/error states; exact DNS instructions; hostname and TLS both active before serving; workspace isolation; retry/backoff; removal preserves recoverable links. |
| 5.6 | Rollout acceptance and owner notifications | Review 50 representative migrated pages side by side; 100% legacy slugs resolve through 301s; one real custom domain in production for at least seven days; verify fallback to direct `/b/{slug}` rendering. |

## First implementation target

Start 5.1 with the existing migrated bio schema and service reads. Build the public renderer and content-extreme fixtures before adding host routing. Reuse that component in the dashboard preview. The legacy public layout is migration evidence, not the visual design target.

## Acceptance still carried from P4

Live OAuth, external email delivery, Polar sandbox lifecycle/history/invoices, actual legacy-host handoff, legacy bio rendering, staging public-link checks, full page-map/parity review, owner sign-off, seven-day P1 observation and zero-drift billing reconciliation remain tracked in 16 and its local audit. Starting P5 does not close them.

## Operator steps

Production routing changes, owner notification sends and paid provider provisioning follow review of the concrete staged result. Keep `/b/*` on the existing renderer until the replacement has passed acceptance; retain direct rendering as the rollback path.
