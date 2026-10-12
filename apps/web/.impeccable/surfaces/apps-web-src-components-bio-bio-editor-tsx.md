---
version: 1
slug: "apps-web-src-components-bio-bio-editor-tsx"
primary_target: "apps/web/src/components/bio/bio-editor.tsx"
related_targets:
  [
    "apps/web/src/components/bio/link-manager.tsx",
    "apps/web/src/components/bio/bio-editor.css",
  ]
---

# Bio studio extension

Request: make the first-draft editor less vertical and confusing. Use a visual drag/drop canvas; links are collections with their own searchable, paginated editor; adding links is a separate step; public collections offer vertical or paginated display. Retain drafts, publish, restore. Upload avatars, thumbnails, image sections and covers. Explicit latest correction: NO SHEETS or drawers; drag must retain section dimensions.

## Direction contract

THESIS: The public page is the editing canvas. Focused tasks open controls with a live side preview in the same bounded workspace, with a clear return. The canvas remains the initial view; focused views retain visual feedback. Avoid all sheets.

OWN-WORLD: Extend Shortn's established navy/white, Geist, subtle surfaces, hairline dividers, 6px controls and existing signal/focus colors. Teams use this at desks in daylight; retain the light application shell and user-authored public themes.

STORY: Select a section on the canvas, edit its properties, manage its links, add an existing or new link in a separate step, then return and publish. Hundreds of links are searchable and paginated; published visitors independently paginate.

FIRST VIEWPORT: Toolbar above one centered phone/desktop canvas. Add section on the left, Publish on the right, draft status immediately below. No persistent inspector.

FORM: Operate, code-led extension, user-selected visual canvas and focused in-page editors. No concept seed or approved comp applies.

FINISH: unreviewed and undocumented is unfinished; this ordinary extension ends with the finish review, scoped verdict and updated surface brief. Preserve PRODUCT.md, existing DESIGN.md/.impeccable/design.json state and the incumbent visual world. No shipping raster assets are introduced.

## Quality bar

Match the incumbent Shortn shell's Linear/Dub-like clarity. No sheets, no form wall. Section and link sorting retain dimensions, support keyboard, and expose order controls. Stable attribution IDs survive grouping. Uploads retrieve real stored PNGs. Desktop1440x1000/mobile390x844 controls must fit inside the workspace; no horizontal clipping. Empty/loading/error states remain actionable. English/Portuguese/Spanish strings. The first canvas is useful without opening any controls. Preserve the incumbent design system; no shipping raster assets are introduced.

## Verification evidence — final handoff (2026-10-12)

Parent verification reports all 15 root typecheck tasks, 15 lint tasks and 30 test tasks passing, plus 13 targeted Mongo/Redis/schema tests. `apps/web/e2e/studio.local.ts` passed the 125-link manager, search and existing-library pagination, all five stored-image upload paths (avatar, thumbnail, image section, cover, favicon), published favicon metadata, no sheets, keyboard and pointer drag dimensions, four card layouts, image-only fallback, corners/fitting, publish, stable attribution and public pagination. Mobile assertions measure button/input descendant bounds inside the workspace, beyond document overflow alone. Zero browser console/page errors were reported. These are the implementation run's results; this documentation pass did not rerun suites.

Seven final captures are in `.impeccable/review/`: `desktop.png`, `mobile.png`, `desktop-links.png`, `mobile-links.png`, `desktop-customization.png`, `public-grid.png`, `public-image-cards.png`. The handoff inspected mobile link management, desktop customization and public image cards directly. The earlier mobile inner clipping finding is resolved: actions wrap and workspace/fieldset descendants stay within their bounds. The initial detector `/tmp/p5-studio-detect.json` was empty; no second detector was run. Development issue chrome in captures is separate from the product; final browser error checks are clear.

## Shipped interaction and settings

The editor route `/{workspace}/bio/{id}/editor` opens one public-renderer canvas with phone/desktop sizing. Section selection, adding sections, outline, theme, Page settings, history and link management replace the canvas within the bounded workspace; Back to canvas returns to it. Drafts autosave, Publish saves before publishing, and history restores a saved version. Pointer/keyboard sorting and explicit order buttons preserve section dimensions and stable IDs.

A collection's focused settings expose vertical or independently paginated display, list/small squares/large squares/image cards, page size (4/6/10/20/50), arrows or localized text controls, and optional page/link counts. Non-list cards support image with text, image only or text only; theme/square/rounded corners; cover/contain fitting. An image-only card without a thumbnail shows its title; uploaded image-only cards retain an accessible link name. Manage links offers search, 20-row management pages, separate existing-library/new-link steps, title/thumbnail/highlight/visibility, ordering and removal. Page settings owns handle, language, SEO, indexing and favicon; public `/_bio/{handle}` metadata emits its stored PNG icon and shortcut.

## Incumbent comparison and verdict

Source comparison checked `packages/ui/src/tokens.css` (navy/white, Geist, 13px small type, 6px control corners), `packages/ui/src/theme.css` (semantic utility bindings), and the incumbent `OptionGroup` control treatment. Studio controls reuse primary/foreground/background/divider/signal variables, 13px labels, 6px corners and visible signal focus. The bounded editor frame and authored public card/theme values stay surface choices. Public square grids implement the user's explicit collection preference; they do not replace the global product direction.

Checked source spans: `bio-editor.tsx:24–135` and `link-manager.tsx:18–68` for workspace/settings flows; `public/link-collection.tsx:6–20` for accessible names and pagination; `bio-editor.css:1–40` for semantic styling and width constraints; `public/bio.css:47–70` for square label sizing, corners and fit; `app/%5Fbio/[handle]/page.tsx:9–15` for favicon metadata. The square label fix uses content-sized flex so titles remain visible. No new global token/component drift was identified in this scope. Pre-existing legacy lint warnings remain recorded in the P5 breakdown; this pass does not repair them. Root DESIGN.md/sidecar were absent in the inspected tree and remain absent under the explicit preservation boundary.

Reviewer disposition: **ship**, scoped to the scored fixes and latest preference delta alongside the prior full review. Blank square labels and mobile inner clipping are resolved; content/corner/fit options match the request. No remaining material fixes were found within that verdict scope. This is development acceptance; P5 production rollout gates remain as documented in `docs/rebuild/18-p5-breakdown.md`.

## Scope added during implementation

User requested customized pagination (arrows/text, optional page and link amounts, page size), vertical/small squares/large squares/image cards, and favicon upload. These controls belong to a collection's focused settings, and favicon to Page settings. No sheets remains binding. Browser verification now uses a separate disposable page so the user's seeded directory edits are preserved. DndContext IDs are stable to prevent SSR hydration attribute mismatches. Mobile row actions wrap into a second line and grid/fieldset widths are constrained. Verification measures actual button/input descendant bounds within the workspace.

Final review evidence also includes desktop-customization.png and public-grid.png. No second detector is run; the initial detector was empty and source expansion is covered by the reviewer.

Latest square controls: image with text / image only / text only, theme / square / rounded corners, cover / contain fitting. Image-only falls back to a title until a thumbnail exists and keeps the anchor's accessible name when its visual caption is hidden. Final expanded capture adds public-image-cards.png. Blank square labels fixed by content-sized flex basis; browser measures label height.

## Minimal styling and controlled input refinement (2026-10-12)

Collection settings now include a collapsed Link styling group: theme/minimal/soft/filled/outlined surfaces, theme/none/subtle/solid/divider borders, text weight, spacing and optional trailing arrows. Pagination independently offers muted/minimal/outlined/filled appearances and small/comfortable controls. The default pagination is small and muted. Explicit borderless collection settings override an outlined page theme; keyboard focus remains visible.

Older draft data is normalized on editor initialization, new collections use the schema's shared default factory, and input/select/checkbox values have defined fallbacks throughout their mounted lifetime. This also handles editor state retained by development hot reload when new settings are introduced.

Refinement verification: all 15 typecheck tasks and all 15 lint tasks passed; seven content tests passed. The expanded disposable-page browser regression passed with zero console/page errors, covering existing and new collection checkboxes, persistence, minimal links under an outlined theme, small muted pagination, visible keyboard focus, independent public pagination and mobile bounds. One bounded visual inspection checked public-minimal-desktop.png, public-minimal-mobile.png and mobile.png. The refinement detector returned no findings. This narrow refinement preserves the existing editor direction and uses no sheets.

## Side preview in focused views (2026-10-12)

The user requested live visual feedback throughout the editor's other views. All focused panels—add section, outline, section settings, link management (including its nested steps), theme, page settings and history—now share a public-renderer preview of the current draft. The canvas remains the entry view. Controls lead on the left and the preview supports on the right when the editor container is at least 900px wide; narrower containers stack the preview below the controls. Container sizing accounts for the application navigation rather than relying only on viewport width. The desktop preview stays sticky as settings scroll and has its own bounded scroll area for long pages. Existing phone/desktop controls also size the side preview. Links remain in preview mode.

Verification: web typecheck and lint passed. The full disposable-page browser regression passed with zero console/page errors, including immediate theme/profile updates, all focused panels, all four link layouts, side-by-side geometry, mobile stacking and intermediate/mobile overflow. Existing drag dimensions, 125-link management, uploads, publication and pagination checks remain green. Desktop theme and mobile preview captures were inspected; controls and page remain legible within the bounded workspace. Layout detector scans before and after the change returned no findings. No sheets or global design changes were introduced.

## Preset state and large-library selection (2026-10-12)

Preset selection now derives from the draft's theme tokens instead of binding the select to an empty value. Matching themes display their preset after reopening the panel; manual deviations display a localized Custom option. Shared editor selects have explicit accessible labels.

The existing-link picker uses searchable workspace tag filters, optional grouping by tag, a paginated selection table, and bulk add. Selection persists across pages and filters. Users can select a page, a group on the current page, or all matching results up to the collection's remaining 1,000-link capacity. Bulk selection is bounded on the server and uses the same workspace ownership and tag matching as the main Links page. Already-added links are disabled and excluded from bulk additions. Page changes clear stale library rows immediately while the next result loads.

The user's screenshot showed selected tags overflowing the neighboring control and inconsistent styling. The picker now reuses the main Links page's FilterField, shared Combobox and secondary button variants, compact tag chips and table styling. Multiple selected tags display a compact count; long single labels and chips truncate within their containers. Grouping remains a separate field and mobile controls stack. The local synthetic directory has Product, Marketing and Support tags, added only to resources without tags so existing edits are preserved.

Verification: web typecheck and lint passed. The expanded disposable-page browser regression passed with zero console/page errors, covering preset/custom state, 1,005 tagged links plus a foreign-workspace record, tag filtering and grouping, multi-page and cross-filter selection, the 1,000-link bulk cap, workspace isolation, exact multi-select bounds, mobile clipping and all earlier studio flows. Desktop multiple-tag and mobile captures were inspected together after the final change; no overlap remains. The scoped detector returned no findings. This refinement preserves the existing design and adds no sheets.
