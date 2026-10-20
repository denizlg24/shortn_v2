# Product

## Platform

web

## Stack

Rebuild in progress (see `docs/rebuild/`). Target: bun + Turborepo monorepo; Next.js 16 (App Router) for dashboard, marketing and bio pages; Bun/Hono redirect + API services; MongoDB Atlas; Redis; shadcn/ui primitives on Tailwind v4 (primitives only — the visual language is replaced). Self-hosted on Laravel Forge behind Cloudflare.

## Users

- **Primary:** marketing and communications teams at SMBs and media publishers (reference customer: Vida Económica, a Portuguese economic magazine). Editors and marketers create dozens of links a day for articles, newsletters, social posts and printed QR codes, then read campaign performance weekly. Desk work, mostly desktop, often in a hurry between publishing tasks.
- **Secondary:** creators and small brands who come for link-in-bio pages on the free/basic tiers; mobile-heavy, care about how their public page looks.
- **Machine users:** developers and AI agents operating links through the REST API, MCP server and llms.txt.

## Purpose

Create, manage and measure every link an organization shares, in print and digital: short links, dynamic QR codes, link-in-bio pages and campaigns with one unified analytics view.

## Positioning

- EU / Portuguese-first: GDPR-clean analytics, native pt/es/en. Billed in USD with a euro estimate (checkout currency); hosting location is not yet documented, so it is not claimed.
- All-in-one for print + digital: links, print QR, bio pages and campaigns share one data model and one analytics view.
- Fast and honest: instant redirects, transparent link safety (scanning, interstitials, reports), no dark patterns in billing.
- Developer- and AI-friendly: public API, API keys, webhooks, MCP server and llms.txt are first-class.

## Evidence

- Serving Vida Económica in production.
- 160,000+ clicks and scans counted for Vida Económica, 2,600+ links, 540 QR codes, 14,000+ QR scans since January 2026 (measured 2026-10-17; definitions in docs/rebuild/21-marketing-content.md §5). The older "2.4M+ clicks" figure was false.

## Brand commitments

- Name **Shortn** and the logo mark (heavy grotesque white "S" in a deep navy square) stay.
- Brand colors stay: deep navy ink (`oklch(0.208 0.042 265.755)`, ≈ #0f172b) paired with white. New palette work extends from these; it does not replace them.
- Domain: `shortn.at`.
- Visual direction (chosen 2026-10-09): **the category standard, executed at full craft**. Conventions are embraced without irony or smuggled quirk. Craft bar: **Linear** and **Dub.co**. Explicit anti-goals: boxy card grids, decorative gradients, glassmorphism, generic icon tiles, "AI SaaS" hero tropes.

## Terminology

Link (short link), key (the slug part), domain, QR code, scan, click, bio page (link-in-bio), handle (bio subdomain), campaign, tag, workspace, member, plan, add-on.

## Accessibility & localization

- Locales: en, pt, es (all UI, emails and public pages). Portuguese strings run ~20–30% longer than English.
- WCAG 2.2 AA for app and public bio pages.

## Open decisions

- Final pricing and plan limits for the rebuilt billing model (current limits grandfathered until decided).
