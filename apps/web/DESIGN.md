---
name: Shortn
description: A keyboard-first link desk in brand navy and white, carried to display scale for the marketing site.
colors:
  brand-navy: "oklch(0.208 0.042 265.755)"
  primary-hover: "oklch(0.285 0.05 265)"
  primary-fg: "oklch(1 0 0)"
  signal: "oklch(0.545 0.19 262)"
  signal-fg: "oklch(1 0 0)"
  signal-wash: "oklch(0.545 0.19 262 / 9%)"
  bg: "oklch(1 0 0)"
  bg-subtle: "oklch(0.985 0.004 265)"
  bg-muted: "oklch(0.965 0.007 265)"
  field: "oklch(1 0 0)"
  overlay: "oklch(1 0 0)"
  line: "oklch(0.925 0.01 265)"
  line-strong: "oklch(0.87 0.014 265)"
  fg: "oklch(0.208 0.042 265.755)"
  fg-muted: "oklch(0.46 0.03 265)"
  fg-subtle: "oklch(0.54 0.025 265)"
  success: "oklch(0.52 0.13 150)"
  warning: "oklch(0.53 0.12 65)"
  danger: "oklch(0.55 0.2 27)"
  danger-hover: "oklch(0.5 0.19 27)"
  scrim: "oklch(0.208 0.042 265.755 / 16%)"
  chart-2: "oklch(0.55 0.18 352)"
  chart-3: "oklch(0.645 0.1 185)"
  chart-4: "oklch(0.67 0.13 80)"
  chart-5: "oklch(0.46 0.15 297)"
  chart-6: "oklch(0.47 0.12 52)"
  dark-bg: "oklch(0.165 0.004 265)"
  dark-bg-subtle: "oklch(0.193 0.005 265)"
  dark-bg-muted: "oklch(0.245 0.006 265)"
  dark-fg: "oklch(0.968 0.002 265)"
  dark-fg-muted: "oklch(0.755 0.006 265)"
  dark-signal: "oklch(0.7 0.15 262)"
  band-bg-subtle: "oklch(0.245 0.045 265)"
  band-field: "oklch(0.25 0.045 265)"
  band-fg: "oklch(0.985 0.003 265)"
  band-fg-muted: "oklch(0.82 0.025 265)"
  band-signal: "oklch(0.78 0.12 262)"
  band-dark-bg: "oklch(0.205 0.04 265)"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.375rem, 1.55rem + 3.4vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.45rem + 1.7vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  subhead:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.12rem + 0.5vw, 1.625rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  figure:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.55rem + 1.8vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  lede:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  section:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.25rem"
  title:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.015em"
  emphasis:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  body:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  small:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: "1.125rem"
  meta:
    fontFamily: "Geist Variable, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  data:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.125rem"
    fontFeature: "tnum"
rounded:
  none: "0px"
  chip: "4px"
  control: "6px"
  overlay: "8px"
spacing:
  unit: "4px"
  cell: "12px"
  gutter-mobile: "16px"
  gutter: "24px"
  header-row: "36px"
  row: "44px"
  page-header: "56px"
  rail: "56px"
  sidebar: "232px"
  marketing-container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.primary-fg}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.field}"
    textColor: "{colors.fg}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.bg-subtle}"
  button-ghost:
    textColor: "{colors.fg-muted}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.bg-muted}"
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.control}"
    height: "32px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-marketing-cta:
    backgroundColor: "{colors.band-fg}"
    textColor: "{colors.brand-navy}"
    typography: "{typography.emphasis}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.fg}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "4px 10px"
    height: "32px"
  tag-chip:
    textColor: "{colors.fg-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.chip}"
    padding: "2px 6px"
    height: "20px"
  tab:
    textColor: "{colors.fg-muted}"
    typography: "{typography.small}"
    height: "40px"
  tab-active:
    textColor: "{colors.fg}"
  table-row:
    backgroundColor: "{colors.bg}"
    typography: "{typography.small}"
    rounded: "{rounded.none}"
    height: "{spacing.row}"
  table-row-hover:
    backgroundColor: "{colors.bg-subtle}"
  table-row-selected:
    backgroundColor: "{colors.bg-muted}"
  overlay-surface:
    backgroundColor: "{colors.overlay}"
    textColor: "{colors.fg}"
    rounded: "{rounded.overlay}"
  band:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.band-fg}"
    rounded: "{rounded.none}"
  link-object:
    backgroundColor: "{colors.band-field}"
    textColor: "{colors.band-fg}"
    rounded: "{rounded.overlay}"
    padding: "24px"
---

# Design System: Shortn

## Overview

**Creative North Star: "The Newsroom Link Desk"**

Shortn is the category standard executed at full craft, with Linear and Dub.co as the bar. It's a quiet, dense working surface for editors who create dozens of links a day. Brand navy is the ink and the primary fill, the neutrals are tinted with the same navy hue (265), and one signal blue marks whatever is interactive or in focus. Structure comes from 1px hairlines and space rather than boxes. The table is the product: 44px rows, tabular figures, and actions that apply instantly. Light mode is the default (a daylit desk). Dark mode is a near-neutral graphite with a faint cool tint, so navy and signal blue stay meaningful instead of tinting every surface.

The marketing site is the same world at display scale, not a separate brand. Brand-navy **bands** own whole stretches of the page: the header and hero, the proof strip, and the closing call to action. White (graphite in dark mode) reading bands sit between them. Inside a band the tokens are remapped, so every dashboard control works unchanged on navy. Schibsted Grotesk 800, a news-publisher grotesque whose heavy weight echoes the logo's "S", is used only for marketing display type. Everything else is Geist.

The system explicitly rejects KPI card mosaics, decorative gradients, glassmorphism and glows, icon-in-rounded-square tiles, nested boxes, and the centred-slogan-over-floating-dashboard hero.

**Key Characteristics:**

- Navy-tinted neutrals on white; near-neutral graphite in dark mode. Brand navy is used for ink and primary fills.
- One signal blue, reserved for focus, text links, selection and chart series 1.
- 1px hairlines instead of cards. The only shadow belongs to floating overlays.
- Geist for UI, Geist Mono for figures. Schibsted Grotesk 800 for marketing display only.
- Small radii: 4 / 6 / 8 px, and 0 for rows and page sections.
- Short, functional motion (120–180 ms). Reduced motion collapses it all.

## Colors

The palette is a single hue with one accent: navy at every lightness, white, and one saturated blue that means "you can act here".

### Primary

- **Newsroom Navy** (`brand-navy`): the brand ink. In light mode it is the body text color, the primary button fill, the tooltip ground and the marketing band field. It is the color of the logo square and does not change.
- **Pressed Navy** (`primary-hover`): the hover state of navy fills only.

### Secondary

- **Signal Blue** (`signal`, dark `dark-signal`, on bands `band-signal`): focus rings (2px outline, 2px offset), text links, the input caret, checked checkboxes, selection tint, the focused field border and chart series 1. **Signal Wash** (`signal-wash`) is the 9% tint that flashes a freshly created row.

### Tertiary

- **Status trio** (`success` green 150, `warning` amber 65, `danger` red 27): link health, safety, billing state and destructive actions. Nothing decorative.
- **Chart series 2–6** (`chart-2` to `chart-6`, magenta, teal, ochre, violet, rust): checked for CVD separation in both themes by `bun run check:tokens`. They appear only in charts, and through the tag palette below.
- **Tag palette** (`tag-slate`, `tag-blue`, `tag-teal`, `tag-violet`, `tag-magenta`, `tag-ochre`, `tag-rust`): the only colours a user chooses. Teal to rust reuse the chart hues; slate is the default and blue sits well away from signal. They render only as small dots before a tag name, never as fills or text, and `check:tokens` holds each at 3:1 on `bg` and `overlay`.

### Neutral

- **Paper** (`bg`): the page.
- **Desk Grey** (`bg-subtle`): the sidebar, table header, hovered row and product-shot well.
- **Pressed Grey** (`bg-muted`): selected row, ghost-button hover and highlighted menu item.
- **Hairline** (`line`) / **Firm Hairline** (`line-strong`): every divider and table rule, and the borders of inputs and secondary buttons.
- **Muted Ink** (`fg-muted`): secondary text, at least 4.5:1 on `bg`. **Faint Ink** (`fg-subtle`): placeholders, meta, the muted domain in a short link.
- **Graphite Desk** (`dark-bg`, `dark-bg-subtle`, `dark-bg-muted`, `dark-fg`, `dark-fg-muted`): the dark-mode remap applied under `.dark`. Surfaces carry chroma 0.004–0.006 at hue 265, just enough cool to avoid mud, and step up in lightness: `bg` → `bg-subtle` → `overlay` → `bg-muted` (so a highlighted menu item still reads on a popover). Text greys are near-neutral: body `fg` holds 7:1 on every surface, `fg-muted` and `fg-subtle` hold 4.5:1. Navy appears only where it carries brand meaning: the primary fill inverts to near-white with brand-navy text on it, and the marketing band stays a navy field.

### Band remap (marketing)

A `.band` section sets `color-scheme: dark` and remaps the semantic tokens over a `brand-navy` field: `band-bg-subtle` and `band-field` for raised areas and inputs, `band-fg` for text, `band-fg-muted` for secondary text, white-alpha hairlines (12% / 22%), and a lighter `band-signal`. The primary fill becomes near-white with navy text, so the main CTA on navy is a white button. In dark mode the band sits at `band-dark-bg`, a navy field that reads clearly against the graphite page.

### Named Rules

**The Ink Is the Brand Rule.** Brand navy is the text color and the primary fill. There is no second brand color, and new palette work extends navy rather than replacing it.

**The One Signal Rule.** Signal blue appears only where the user can act or is focused: links, focus, selection, the caret, checked controls and chart series 1. It never colors checkmarks, code strings, icons or decoration.

**The Status-Only Rule.** Green, amber and red describe state. They never decorate or categorize.

**The Remap, Don't Restyle Rule.** A navy surface is made by putting content inside `.band`, which remaps tokens. Never make a navy variant of a component.

## Typography

**Display Font:** Schibsted Grotesk Variable 800 (falls back to Geist). Marketing only, self-hosted via `@fontsource-variable/schibsted-grotesk` and loaded only by the marketing layout.
**Body Font:** Geist Variable (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono Variable, always with tabular numerals

**Character:** Geist is a neutral, precise workhorse with full pt/es coverage. Schibsted's heavy newsprint grotesque gives the marketing pages a publisher's voice without leaving the product's world.

### Hierarchy

- **Display** (Schibsted 800, 38–72 px fluid, line-height 1.02, tracking −0.035em): page-head h1 and the closing-band h2. Measure is capped at 18–20ch and wraps are balanced.
- **Headline** (Schibsted 800, 30–48 px fluid, 1.06, −0.03em): marketing section h2s, max 40rem wide.
- **Subhead** (Schibsted 800/700, 20–26 px fluid, 1.2, −0.02em): legal h2s and the short link inside the link object.
- **Figure** (Schibsted 800, 32–52 px fluid, line-height 1, −0.03em): proof numerals in the marketing figure strip.
- **Lede** (Geist 400, 18 px, 1.6): intro paragraphs under display and headline type, 48–56ch, `text-fg-muted`.
- **Section** (Geist, 28 px / 36 px) and **Title** (Geist 600, 20 px / 28 px, −0.015em): dashboard page titles and StatStrip values.
- **Emphasis** (16 px / 24 px): marketing point lists and large CTAs.
- **Body** (14 px / 20 px): the default `body` size in the dashboard.
- **Small** (13 px / 18 px, often 500): table cells, buttons, labels, menu items and tabs.
- **Meta** (12 px / 16 px): column headers, hints, chips, captions and source lines.
- **Data** (Geist Mono, tabular): clicks, dates in tables, API keys, `kbd` and `code`.

Legal long-form (`.legal`) uses 16 px / 1.7 at a 70ch measure in `fg-muted`. Its h2s are Schibsted subheads, its h3s are 17 px Geist 600, and its links are signal blue and underlined.

### Named Rules

**The Two-Scale Rule.** The dashboard uses the 12–28 px Geist ramp. The display, headline, subhead, figure and lede sizes exist only in the marketing layer (`apps/web/src/app/globals.css`) and never appear in the app.

**The Tabular Figures Rule.** Any number a reader compares (clicks, scans, counts, prices, dates in tables) uses tabular numerals.

**The Heavy-or-Nothing Display Rule.** Schibsted appears only at weight 800, or 700 for the link-object key, with negative tracking between −0.02 and −0.035em. It is never used for body text.

## Layout

The base unit is 4px. The page gutter is 24px, or 16px below 768px. Table cells have 12px horizontal padding, rows are 44px tall and header rows 36px. The dashboard page header is 56px and sticky. The app shell has a 232px sidebar that collapses to a 56px icon rail below 1200px and becomes a drawer on mobile. Leave more space above a heading than below it. Settings forms are a single column, max 560px.

The marketing pages use a centred container of max 1200px with 16 or 24px padding and a 12-column grid at `lg`. The hero splits 7/5 (headline, body and demo field on the left, the link object on the right). Proof figures run as a 4-across strip separated by hairlines, which becomes 2×2 on mobile. Bands get generous vertical padding: 56–80px at the top of a page head, 80–112px in the closing band. Sections are separated by space and hairlines, never by cards.

Below 768px the dashboard table becomes a two-line list. Marketing pages stack in reading order, and pt/es headlines, which run up to 40% longer, must fit at 390px.

**The Hairline, Not Box Rule.** Group things with a 1px `line` rule and space. A bordered container is allowed only around a self-contained object (an overlay, a field, the link object, a product capture), and never inside another bordered container.

## Elevation & Depth

The system is flat, with depth expressed through tonal steps (`bg` → `bg-subtle` → `bg-muted`) plus one structural shadow. Page content, cards and product captures never cast shadows.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 8px 24px -8px oklch(0.2 0.04 265 / 18%)`, dark `oklch(0 0 0 / 55%)`): popovers, menus, dialogs, tooltips and the command palette. Always paired with a 1px `line` border and `overlay` background.
- **Scrim** (`scrim`, 16% navy, or 60% near-black graphite in dark mode): behind dialogs only.

### Named Rules

**The Overlay-Only Shadow Rule.** Only something floating above the page gets a shadow. If it sits in the page flow, it gets a hairline.

## Shapes

Corners stay small and functional: **4px** for chips, checkboxes and QR thumbnails; **6px** for buttons, inputs, menu items and focusable links; **8px** for overlays, dialogs, the link object and product-capture frames; **0** for table rows, page sections and bands. Borders are always 1px. Tab indicators are 2px bars with rounded ends. Status dots and tag colour dots (6–8px) are the only full circles.

**The 4/6/8/0 Rule.** No radius outside this scale. In particular, no `rounded-xl` or `rounded-2xl` panels.

## Components

### Buttons

Quiet, compact and immediate.

- **Shape:** gently squared (6px).
- **Sizes:** 28 / 32 / 36 px tall (`sm`/`md`/`lg`), with 16px icons in a 6px gap. Marketing CTAs extend `lg` to 48px tall with 20px padding at emphasis size, followed by a trailing arrow.
- **Primary:** navy fill, white text. Hover steps to Pressed Navy. On a band it inverts to a white fill with navy text.
- **Secondary (default):** field background, 1px `line-strong` border, `fg` text. Hover lifts to `bg-subtle` and darkens the border.
- **Ghost:** `fg-muted` text with no fill. Hover and expanded states use `bg-muted` with `fg` text.
- **Danger / Danger Ghost:** red fill with white text, or red text over a 10% red hover. For destructive actions only.
- **States:** color transitions run at 120ms. Disabled is 50% opacity with `not-allowed`. Focus is the global 2px signal outline.

### Chips

- **Style:** 20px tall, 4px radius, a 6% `fg` tint background, meta-size `fg-muted` text, max 8rem wide with truncation. A tag chip leads with its 6px colour dot. Overflow collapses into a mono "+N" chip with a tooltip.
- **State:** chips are labels, not controls. Active filters are filter tokens, below.

### List toolbar and filter tokens

- **One row:** search (applies on Enter or after 300ms), a secondary `Filter` button, a ghost sort/display menu, and the result count at the right. No stacked field labels; every control has an accessible name. Below 640px, Filter and sort collapse to 32px icon buttons and the count moves to the token row.
- **Filter menu:** a popover listing facets (Tag, Status, Domain, Campaign, Created) that drills into one facet in place. Multi-select facets keep the popover open; single-choice facets close it. Large option sets are searched and paged on the server, never listed whole.
- **Tokens:** each active filter is one 28px bordered token, `Field operator value ×`: the field in `fg-muted`, the operator in `fg-subtle`, the value in `fg` 500 truncated to a bounded width. The token body reopens its facet; × removes it. Tokens wrap, followed by `Clear all`. The URL stays the source of truth.

### Selection bar

Bulk actions exist only while something is selected. The bar floats at the bottom of the content column (an overlay surface, so it carries the overlay shadow), sits above the mobile tab bar, and settles after the list when scrolled to the end. It states the count and the per-action limit, then the actions; below 640px they fold into an Actions menu. "Select this page" is the checkbox in the table header.

### Cards / Containers

- **Corner Style:** none for page structure. 8px only for self-contained objects.
- **Background:** `bg`, with `bg-subtle` for wells and headers.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px `line`.
- **Internal Padding:** a 12px cell rhythm in tables, 20–24px in the link object.

### Inputs / Fields

- **Style:** 1px `line-strong` border, `field` background, 6px radius, 28/32/36 px tall with optional leading and trailing icons in `fg-subtle`. The marketing demo field is 48px tall.
- **Focus:** the border turns signal blue and gets a 1px signal ring. The caret is signal blue.
- **Error / Disabled:** the border and ring turn `danger` and the message sits below in meta size. Disabled is 50% opacity. Labels are small 500 weight, and hints are meta `fg-muted`.

### Navigation

- **Dashboard:** a sidebar of 32px rows (6px radius) in small type, with icons in `fg-subtle`. Hover and the active item use a `bg-muted` fill. The active item also gets `fg` 500 text and a navy icon. Tabs are underline-style, 40px tall, with a 2px navy bar on the active tab and `fg-muted` on inactive tabs. Menus use 32px items with a `bg-muted` highlight.
- **Marketing header:** a 64px band containing the 26px logo mark with a Schibsted wordmark, three text links in `fg-muted` (hover and current use `fg`), a ghost "Sign in" and a primary "Get started". Below `md` it collapses into a menu disclosure. A skip link appears on focus.

### Table rows (signature)

44px rows on a 0-radius grid with `line` dividers. Hover is `bg-subtle` and selected is `bg-muted`, both instant with no transition. New rows flash `signal-wash` and fade out over 1.8s. The header row is 36px in meta 500 `fg-muted` on `bg-subtle`. A short link renders the domain in `fg-subtle` and the key in `fg` 500.

### Band (signature, marketing)

A full-bleed navy section that remaps tokens (see Colors). Pages open on a band (the PageHead or hero) and long pages close on one (ClosingBand: display h2, lede, and primary plus secondary 48px CTAs). Reading bands between them are `bg` or `bg-subtle`.

### Link object (signature, marketing)

An 8px-radius bordered `field` panel. It has a 40px caption bar ("Example", or the result label with a green status dot), the short link in Schibsted subhead with a muted host and full-weight key, the destination in mono, and the QR at 96–112px with a 4px radius. When the visitor submits, the key writes itself in (`key-reveal`: a clip-path wipe in 12 steps over 420ms) and then the QR resolves from top to bottom like a scanner pass (`qr-resolve`: 520ms `cubic-bezier(0.16, 1, 0.3, 1)` after a 260ms delay). With reduced motion the swap is instant.

### Product capture (marketing)

Real dashboard screenshots only, with light and dark captures swapped to match the theme. Each sits in an 8px-radius frame with a 1px `line` border on `bg-subtle`, with no shadow. A sample-data caption in meta `fg-subtle` appears once per page.

## Do's and Don'ts

### Do:

- **Do** take every color from the semantic tokens (`bg`, `fg`, `line`, `signal` …) so light, dark and `.band` remaps all work without variants.
- **Do** separate content with a 1px `line` hairline and space. Stats go in a single hairline-divided strip.
- **Do** keep signal blue for links, focus, selection, checked controls and chart series 1.
- **Do** use tabular Geist Mono for figures a reader compares.
- **Do** keep motion between 120 and 180ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`, keep row hover and selection instant, and let `prefers-reduced-motion` collapse everything.
- **Do** open marketing pages on a navy band and close long ones on another, with Schibsted 800 display type at negative tracking.
- **Do** use 16px lucide icons inline with text, only where they carry meaning.

### Don't:

- **Don't** build KPI card grids, nested bordered boxes, or `rounded-2xl` panels.
- **Don't** use decorative gradients, glassmorphism, glows, blurred blobs or "AI sparkle" iconography.
- **Don't** use icon-in-rounded-square tiles as decoration.
- **Don't** put a shadow on in-page content, including product screenshots.
- **Don't** color checkmarks, code strings or decoration with signal blue.
- **Don't** use display sizes or Schibsted Grotesk inside the dashboard.
- **Don't** add eyebrows or kickers above headings.
- **Don't** put a centred slogan over a floating dashboard mock with a logo wall.
