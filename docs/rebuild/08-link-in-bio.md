# 08 — Link-in-Bio

## Today

`BioPage` has a single fixed layout: header (style, background image/color) + avatar + title/description + a list of links (each must be a Shortn link, `ref: UrlV3`) + socials + a theme blob of free-form strings (font sizes as strings, any Google Font via a client-side API key). Pages are served at `shortn.at/b/{slug}`.

## Target

A bio page is an ordered list of **typed blocks** rendered with a constrained theme system and served at `{handle}.shortn.at` or a custom domain.

### Block types (v1)

| Block                | Fields                                                                                                  | Notes                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `profile`            | avatar, name, bio text, verified badge (paid)                                                           | always first, one per page                                     |
| `link`               | linkId _or_ inline URL (auto-shortened into a hidden link so it's tracked), title, thumbnail, highlight | clicks tracked through the redirect pipeline (`ref=bio`)       |
| `socials`            | list of `{platform, url}`                                                                               | icons from simple-icons, rendered monochrome or brand          |
| `header`             | text                                                                                                    | section divider                                                |
| `text`               | short markdown (bold/italic/links only)                                                                 | sanitized                                                      |
| `image`              | image, alt, optional link                                                                               |                                                                |
| `embed`              | provider ∈ {YouTube, Spotify, SoundCloud, Vimeo, Apple Music}, URL                                      | sandboxed iframe, lazy, consent-gated for GDPR (click to load) |
| `email-signup` (P6+) | list name                                                                                               | stores to workspace audience, export CSV                       |
| `qr`                 | linkId                                                                                                  | shows a QR for in-person sharing                               |

Blocks carry `visible`, `schedule` (show from/to), and a stable `_id` for analytics.

### Theme

- A fixed set of tokens: `background` (solid | image | subtle pattern), `surface`, `text`, `accent`, `buttonStyle` (fill | outline | soft | shadow-less), `radius` (0 | 6 | 12 | full), `font` (one of ~16 curated, self-hosted faces with pt/es glyph coverage), `density`.
- About 12 **preset themes** designed alongside the design system (12). Users start from a preset and tweak tokens. Custom CSS is never allowed.
- An automatic contrast guard: when a user picks `text` against `background` with contrast below 4.5:1, the editor warns and offers the nearest compliant color. Published pages always meet WCAG AA for text.

### Rendering & performance

- Route `apps/web/app/_bio/[handle]` (internal, reached through the host rewrite, 07). It's a Server Component, **statically cached** with Next 16 Cache Components: `"use cache"` + `cacheTag("bio:{id}")`. Publishing calls `revalidateTag`. Cloudflare caches the HTML (`s-maxage=60, stale-while-revalidate=86400`), and a purge-by-URL via the Cloudflare API runs on publish.
- Zero client JS beyond the embed loaders and a ~1 KB view beacon. Page views are sent with `navigator.sendBeacon` to `api.shortn.at/v1/bio/view` → the same Redis stream as clicks (`kind: "bio_view"`). Link clicks from the page go through the redirect service, so they're recorded as normal clicks with `ref=bio:{pageId}`.
- OG image is generated per page (`next/og`) from the profile block + theme and cached by tag.
- SEO: `title`, `description`, `noindex` toggle, canonical = handle URL or the custom domain.

### Editor (dashboard)

- Split view: block list (drag to reorder with `@dnd-kit`, keyboard reorder with ⌥↑/↓) on the left, **live device preview** on the right rendering the real public component (not a re-implementation). The preview switches between phone and desktop widths.
- Autosave drafts. A **Publish** action creates a version, and the last 20 versions are kept and restorable. `bio_page_versions` holds snapshots.
- Inline "add link" accepts a URL or searches existing links.
- Analytics tab: views, CTR per block, top referrers, using the same analytics query engine (04) scoped to the page's links + view events.

## Migration

Covered in 02 §M8 (handle derivation, `bio_aliases`, blocks from legacy fields) and §M12 (images to R2). Additional notes:

- Legacy theme fonts not in the curated list: they're loaded from Google Fonts CSS for that page only, flagged as "legacy font" in the editor with a suggestion, and never removed automatically.
- Legacy header styles (`centered | left-aligned | right-aligned`) map to the profile block's `align`. Header background image/color maps to the theme background.
- Before cutover, a visual parity check of 50 random pages (old vs new, screenshot side by side) is reviewed manually. Owners are notified by email of their new address `{handle}.shortn.at`.

## Plan limits (06)

- Free: 1 page, `{handle}.shortn.at`, "Made with Shortn" footer.
- Paid: more pages (catalog), removable footer, custom domain via add-on, scheduled blocks, email signup.
