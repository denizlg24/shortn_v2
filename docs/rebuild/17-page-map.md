# 17 — Dashboard page map (P4 slice 4.8b)

Implements the owner's IA rules from 12 (superseded IA note, 2026-10-10): full pages only, no sheets or side panels; creation and management on separate pages; explicit, labelled filters; more pages are fine when the flow is clear. All routes live under `app.shortn.at/{ws}`.

## Owner decisions (2026-10-10)

- Destructive actions use a **confirmation page**, not a dialog.
- Item detail is split into **tab pages**, each with its own URL.
- The keyboard layer (⌘K, `C`, `/`, `G`+key) stays, as a secondary path: every action also has a visible control.
- All sections are rebuilt in one pass (no Links-first review gate); the owner reviews the whole app on the dev server.

## Navigation conventions (every page)

- Sidebar: Links, Analytics, QR codes, Campaigns, Bio pages, Settings. The active section is highlighted for all of its sub-pages.
- Every page below a section root has a **breadcrumb** (`Links / shortn.at/abc / Edit`) and its own `<title>`.
- Page header: title, one-line description, and the page's primary action at the right (`New link`, `Edit`, `Save`).
- Detail pages have a **local tab bar of links** (each tab is its own URL, so back/forward and sharing work): e.g. `Overview · Analytics · QR code · UTM · Settings`.
- Forms save and then navigate (create → the new item's page; edit → back to the item with a one-line "Saved" notice). Cancel goes back to where you came from.
- Destructive actions go to a confirmation **page** (`…/delete`) that states what will be lost, not a dialog.
- Filters sit in a visible filter bar above lists: labelled selects, a search field and a date range, with an "Applied filters" summary and "Clear all". Every filter is in the URL.

## Links

| Route | Page | Contents |
| --- | --- | --- |
| `/links` | Links list | Filter bar: search, Tags (multi-select), Created (date range), Status (all / password-protected / flagged / disabled), Sort (newest, oldest, most clicks). Table: short link, destination, tags, clicks, created. Row → link overview. Bulk select → "Delete selected" → confirmation page. Primary: **New link**. |
| `/links/new` | New link | Destination (required), custom key (plan-gated, with explanation), title, description, tags, password + hint (Pro). Create → `/links/{id}?created=1` (copy button prominent). |
| `/links/{id}` | Link overview | Short link + copy, destination, status (safety, password), tags, created/creator, last 30 days chart + clicks/scans/visitors, top 5 countries and referrers with "See all" → analytics tab. |
| `/links/{id}/analytics` | Link analytics | Same analytics page as `/analytics` scoped to this link. |
| `/links/{id}/qr` | Link QR code | Attached QR code preview + download, or "Create a QR code for this link" → `/qr/new?link={id}`. |
| `/links/{id}/utm` | UTM variants | Table of variants (source, medium, campaign, term, content) with the tagged URL + copy; **Add variant** → `/links/{id}/utm/new`; edit/remove per row. |
| `/links/{id}/utm/new` | New UTM variant | Form with campaign defaults as suggestions. |
| `/links/{id}/edit` | Edit link | Same fields as New; key change warns that the old key keeps redirecting. |
| `/links/{id}/delete` | Delete link | What is removed (link, legacy click history archived, campaign membership), confirm. |
| `/links/delete?ids=…` | Delete selected | Bulk version of the above. |

## Analytics

| Route | Page | Contents |
| --- | --- | --- |
| `/analytics` | Analytics overview | Filter bar: Date range (7d / 30d / 90d / 12m / custom), Interval, Link, Country, Device, Browser, OS, Referrer, UTM source / medium / campaign. Stat strip, chart, then breakdown tables (top 10 each) with **See all**. |
| `/analytics/{dimension}` | Breakdown | One full, sortable table for a dimension (countries, cities, devices, browsers, os, referrers, utm-source, utm-medium, utm-campaign, links), same filters, CSV export. |

## QR codes

| Route | Page | Contents |
| --- | --- | --- |
| `/qr` | QR codes list | Filter bar: search, Tags, Created. Grid/list toggle. Primary: **New QR code**. |
| `/qr/new` | New QR code | Destination (or "use an existing link"), title, tags, then design with live preview. Create → `/qr/{id}`. |
| `/qr/{id}` | QR overview | True-size preview, downloads (PNG / SVG / JPEG), destination, scans summary. |
| `/qr/{id}/design` | Design | Split page: controls left, true-size preview right, contrast check. |
| `/qr/{id}/analytics` | Scans | Analytics scoped to the QR code. |
| `/qr/{id}/edit` | Details | Destination (+ "also update the attached link"), title, tags. |
| `/qr/{id}/delete` | Delete | Confirmation. |

## Campaigns

| Route | Page | Contents |
| --- | --- | --- |
| `/campaigns` | Campaigns list | Search, sort. Primary: **New campaign**. |
| `/campaigns/new` | New campaign | Title, description. |
| `/campaigns/{id}` | Overview | Links in the campaign with their variants, totals, chart. |
| `/campaigns/{id}/analytics` | Analytics | Scoped analytics + CSV export. |
| `/campaigns/{id}/builder` | UTM builder | Pick a link, fill source/medium/term/content (defaults as suggestions), copy the tagged URL, "Save as variant". |
| `/campaigns/{id}/edit` | Settings | Title, description, UTM defaults lists. |
| `/campaigns/{id}/delete` | Delete | Confirmation (variants are removed from links). |

## Bio pages

| Route | Page | Contents |
| --- | --- | --- |
| `/bio` | Bio pages list | Primary: **New bio page**. |
| `/bio/new` | New bio page | Slug (with live availability), title, optional first link. |
| `/bio/{id}` | Overview | Public URL + copy/open, live preview, link count. |
| `/bio/{id}/profile` | Profile | Title, description, avatar, avatar shape — with preview. |
| `/bio/{id}/links` | Links | Ordered list, add from workspace links, reorder, per-link title/image — with preview. |
| `/bio/{id}/socials` | Socials | Platform + URL list — with preview. |
| `/bio/{id}/appearance` | Appearance | Colours, button style, font, header — with preview. |
| `/bio/{id}/delete` | Delete | Confirmation. |

## Settings

| Route | Page |
| --- | --- |
| `/settings` | Workspace: name, slug |
| `/settings/members` | Members and pending invites |
| `/settings/members/invite` | Invite member (email, role, what the role can do) |
| `/settings/members/{userId}` | Member: role change, remove |
| `/settings/billing` | Plan, period, usage meters, invoices link |
| `/settings/billing/plans` | Compare plans, upgrade / change / cancel |
| `/settings/account` | Profile |
| `/settings/account/email` | Change email |
| `/settings/account/password` | Change or add password |
| `/settings/account/sign-in` | Sign-in methods (GitHub, Google) |
| `/settings/account/sessions` | Active sessions |
| `/settings/delete` | Delete workspace (team workspaces) |
| `/workspaces/new` | New workspace (outside a workspace context) |
