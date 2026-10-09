# 12 — Design System & UI

Produced with the **impeccable** workflow (`PRODUCT.md` at repo root). Direction round seed `2e7ef8a3` (operate, direction scope). The user picked **the category standard, executed at full craft**, with **Linear** and **Dub.co** as the quality bar. That's a deliberate choice for a convention-literate audience: conventions are embraced as-is, without irony or smuggled quirk. The ambition goes into execution: density, typography, keyboard flow, motion and finish at Linear/Dub level, and none of the generic "AI SaaS" look.

## Direction contract (dashboard world; code-led build)

- **THESIS:** A keyboard-first link desk where the table _is_ the product: dense, quiet rows that act instantly. Refuses the category default of KPI-card mosaics, gradient heroes and modal-heavy flows.
- **OWN-WORLD:** Navy-tinted neutrals on white (dark mode: navy-black), brand navy as ink and primary fill, one signal blue for focus, links and the first chart series. Hairline 1px rules instead of boxes; elevation only on overlays. Geist for UI and Geist Mono for figures, all tabular.
- **STORY:** A marketer pastes a URL, gets a short link on the clipboard in one keystroke, and reads which channel worked without leaving the table.
- **FIRST VIEWPORT:** Sidebar (232px) at left. On the right, the "Links" header row has a count, a search field, filter chips and a primary "Create link" button (C). Below it sits a full-bleed table of 44px rows: favicon, `shortn.at/` muted + **key**, destination, tags, a 30-day sparkline, clicks, and age. A paste anywhere on the page opens the inline composer at the top of the table.
- **FORM:** canon (category standard), user-selected; seed key `2e7ef8a3`.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

> When implementation starts, this contract is written to the dashboard surface brief with `impeccable surface-brief write`, and `DESIGN.md` + `.impeccable/design.json` are generated **from the built world** by the impeccable documenter at finish (not before).

## Scene → theme

A marketer at a desk in a daylit newsroom office, between publishing tasks, on a laptop or external monitor. **Light is the default** and dark is fully supported (system preference + toggle). Public bio pages follow their own theme.

## Anti-goals (enforced in review and by `impeccable detect`)

- No KPI **card grids**. Stats sit in a single strip separated by hairlines.
- No decorative gradients, glassmorphism, glows, blurred blobs, or "AI sparkle" iconography.
- No icon-in-rounded-square tiles as decoration. Icons are 16px lucide, inline with text, used only when they carry meaning.
- No `rounded-2xl` everywhere. Radius scale: 4 (chips), 6 (controls), 8 (popovers/dialogs), 0 (table rows, page sections).
- No nested boxes (border inside border). Sections are separated by space and a hairline, never by a card.
- No modal for anything that can be inline or a side sheet. Dialogs are reserved for destructive confirmation and focused creation.
- No toasts for success on visible changes (the UI itself changes). Toasts are reserved for background results and undo.
- No marketing hero copy along the lines of "Supercharge your links with AI".

## Tokens (`packages/ui/tokens.css`)

Color in OKLCH. Neutrals carry the brand hue (≈265) at very low chroma, so greys feel like Shortn's navy rather than stock slate.

| Token                                  | Light                                                                                                 | Dark                     | Use                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `--bg`                                 | `oklch(1 0 0)`                                                                                        | `oklch(0.155 0.03 265)`  | page                                                       |
| `--bg-subtle`                          | `oklch(0.985 0.004 265)`                                                                              | `oklch(0.185 0.03 265)`  | sidebar, table header, hovered row                         |
| `--bg-muted`                           | `oklch(0.965 0.007 265)`                                                                              | `oklch(0.225 0.03 265)`  | selected row, input fill                                   |
| `--line`                               | `oklch(0.925 0.01 265)`                                                                               | `oklch(1 0 0 / 9%)`      | hairlines                                                  |
| `--line-strong`                        | `oklch(0.87 0.014 265)`                                                                               | `oklch(1 0 0 / 16%)`     | input borders, focus-adjacent                              |
| `--fg`                                 | `oklch(0.208 0.042 265.755)` **(brand navy)**                                                         | `oklch(0.975 0.004 265)` | primary text                                               |
| `--fg-muted`                           | `oklch(0.50 0.03 265)`                                                                                | `oklch(0.72 0.025 265)`  | secondary text (≥ 4.5:1 on bg)                             |
| `--fg-subtle`                          | `oklch(0.62 0.025 265)`                                                                               | `oklch(0.58 0.025 265)`  | placeholder, meta (≥ 3:1, non-essential only)              |
| `--primary`                            | brand navy                                                                                            | `oklch(0.975 0.004 265)` | primary buttons (fill), active nav indicator               |
| `--primary-fg`                         | white                                                                                                 | brand navy               |                                                            |
| `--signal`                             | `oklch(0.56 0.19 262)`                                                                                | `oklch(0.70 0.15 262)`   | focus ring, text links, chart series 1, selection checkbox |
| `--success` / `--warning` / `--danger` | green 150 / amber 75 / red 27, mid-chroma                                                             | lighter variants         | **status only** (link health, safety, billing state)       |
| chart series 2–6                       | derived by the `dataviz` skill's validator from `--signal`, checked for CVD separation in both themes |                          |                                                            |

- Type scale (rem): 0.75 meta · 0.8125 table/body-sm · 0.875 body · 1 emphasis · 1.25 page title · 1.75 section (marketing only) · display sizes for marketing only.
- **UI face:** Geist Sans (incumbent, workhorse, full pt/es coverage). **Figures:** Geist Mono with `font-variant-numeric: tabular-nums` for clicks, dates in tables and API keys.
- **Marketing display face:** chosen during the marketing surface's own impeccable round (Persuade mode), _not_ from the default-face shortlist. The candidate brief is a heavy grotesque that rhymes with the logo's "S". Shortlisted for that round: Schibsted Grotesk (a news-publisher grotesque, resonant for media customers) or a licensed face if budget allows.
- Spacing: 4px base; page gutter 24 (desktop) / 16 (mobile); table cell x-padding 12; more space above a heading than below.
- Motion: 120–180 ms, `cubic-bezier(.2,.8,.2,1)` for overlays and sheets; row hover and selection are instant; list→detail uses View Transitions; `prefers-reduced-motion` disables all non-essential motion.
- Elevation: one shadow token for overlays (`0 8px 24px -8px oklch(0.2 0.04 265 / 18%)` + 1px line). There's no shadow on page content.

## Component inventory (`packages/ui`)

shadcn primitives copied in and **restyled to the tokens** (never the stock theme): Button (primary/secondary/ghost/danger, sizes 28/32/36), Input, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup, Tabs (underline style), DropdownMenu, ContextMenu, Popover, Tooltip (with keyboard hint), Dialog, Sheet (right side, 480–640px), Command (⌘K), Sonner toasts, Calendar/DateRange, Skeleton.

Product components:

- **DataTable** (TanStack Table + virtualized rows): sticky header, column visibility, keyboard row navigation (J/K, Enter, X select, ⌘A), shift-click range select, a bulk action bar that replaces the header row on selection, keyset pagination with "load more" on scroll, and saved views.
- **ShortLink** (domain muted + key emphasized + copy-on-click with a check-mark morph), **Destination** (favicon + host + path truncated in the middle), **TagChips**, **Sparkline** (inline SVG, no axis, last point dot), **StatStrip**, **FilterBar** (chips, each removable, "+ Filter" combobox), **UsageMeter** (exact numbers, never a bare percentage), **EmptyState** (one sentence + the primary action; no illustration slop), **KeyboardHint**, **QRPreview**, **DomainStatus**, **PlanGate** (inline upgrade explanation).
- **Charts:** a thin wrapper over Recharts 3 using tokens: area/line for time series, a horizontal bar list for breakdowns (Dub pattern: label, inline proportional bar, value), and a choropleth for countries (topojson, signal-blue sequential). The `dataviz` skill is loaded before any chart code.

## App shell

- **Sidebar:** workspace switcher (logo mark + name, ⌘O), then Links, Analytics, QR codes, Bio pages, Campaigns; a divider; Domains, Settings. At the bottom: usage meter (compact), Help, account. Collapses to an icon rail at < 1200px and becomes a drawer on mobile.
- **⌘K command palette** everywhere: create link from the clipboard, jump to a link by key, switch workspace, navigate, and run actions on the focused row.
- **Shortcuts:** `C` create link, `/` search, `G L/A/Q/B` go to section, `E` edit, `⌘C` copy short link of the focused row, `?` shortcut sheet.
- Page header pattern: title + count · search · filters · primary action. Sticky. Nothing else.

## Surfaces

| Surface                                       | Mode                                   | Key decisions                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Links                                         | Operate                                | as FIRST VIEWPORT above; row click → right Sheet with tabs Overview (mini chart, top countries/referrers), Edit (sections from 09), QR, Activity; full page `/{ws}/links/{id}` for deep analytics                                                                                                                                                   |
| Create link                                   | Operate                                | inline composer at the top of the table (URL → key suggestion → Enter); "More options" opens the Sheet with all sections; paste-to-create anywhere                                                                                                                                                                                                  |
| Analytics                                     | Operate                                | StatStrip (clicks, scans, uniques, top country) with period delta; full-width time series with interval switcher; below, a two-column grid of ranked bar lists (Countries⇄Map, Referrers, Devices, Browsers, OS, UTM source/medium/campaign). Clicking any row adds a filter. Hairline section separators, no cards                                 |
| QR codes                                      | Operate                                | dense thumbnail grid (whole cells) + list toggle; editor = split view (controls left, true-size preview right, scan-contrast check inline)                                                                                                                                                                                                          |
| Bio pages                                     | Operate (editor) / Experience (public) | split editor with live device preview of the real public component (08); public themes are a separate preset system                                                                                                                                                                                                                                 |
| Campaigns                                     | Operate                                | list → campaign page = links table filtered + analytics scoped to the campaign + UTM builder with defaults                                                                                                                                                                                                                                          |
| Domains                                       | Operate                                | table with status, DNS instructions in an expandable row with copy buttons, live verification state                                                                                                                                                                                                                                                 |
| Settings                                      | Operate                                | left sub-nav: General, Members, Billing, API keys, Webhooks, Imports/Exports, Account. Forms are single-column at 560px max width, with save per section                                                                                                                                                                                            |
| Onboarding                                    | Operate                                | three steps max: workspace name → first link (pasted) → "copy it", optional bio handle claim. Skippable                                                                                                                                                                                                                                             |
| Marketing                                     | Persuade                               | own impeccable round later (canon at full craft, Linear/Dub-level). Hero demonstrates the mechanism live: a working shortener input that creates a real demo link (expires 24 h) and shows the redirect + QR instantly. Real product screenshots only. Proof: Vida Económica (with permission) and a verified click count. Pricing in EUR, pt/es/en |
| Public pages (safety, password, 404, expired) | Read                                   | minimal, localized, brand mark + one clear message + one action                                                                                                                                                                                                                                                                                     |
| Emails                                        | Read                                   | react-email, the same tokens, plain layouts, no hero images                                                                                                                                                                                                                                                                                         |

## States to design for (every surface)

Empty (first-run, with the primary action), loading (skeleton rows that match the real row height; no spinners on page loads), partial (stream lag: "Updated 12 s ago"), error (inline, with retry), permission (viewer role: actions visible but disabled with a tooltip explaining why), plan-gated (inline explanation + upgrade), over-limit, long content (pt strings ~30% longer, 2,048-char URLs, 64-char keys, 50 tags), and huge data (100k links, virtualized).

## Responsive

- ≥ 1200: full sidebar + table with all columns.
- 768–1199: icon rail; the sparkline and tags columns are hidden behind a column menu.
- < 768: the table becomes a two-line list (key + clicks / destination + age). The Sheet becomes a full-screen route, the composer is pinned at the top, and the bottom bar holds the 4 main sections. Creating and copying a link takes one hand and three taps.

## Process (per surface, at implementation time)

1. `impeccable context --target <route>`. The surface brief is written with this contract (dashboard) or a fresh round (marketing, bio presets).
2. Build code-led against the contract; load `reference/craft-floor.md` before UI edits.
3. One batched screenshot round (desktop 1440 + mobile 390, light and dark, **en and pt**) → fix → one confirm round.
4. `impeccable detect --json` on changed files. Then the `impeccable-finish-reviewer` subagent, then the `impeccable-documenter` writes `DESIGN.md` + `.impeccable/design.json` after the first surface ships.
5. Accessibility: axe in Playwright on every route, keyboard-only walkthrough of create/copy/edit/delete, and contrast tokens verified in both themes.

## Acceptance

- Create → copy a short link in ≤ 2 s and ≤ 2 interactions from the links page (paste + Enter).
- Links page interactive in < 1 s on a cold load for a 10k-link workspace (RSC first page + virtualized client table).
- Zero detector findings for the banned patterns, and AA contrast in both themes.
- The side-by-side review against Linear/Dub at equal density reads as the same craft tier (finish reviewer verdict: ship).
