---
version: 1
slug: "apps-web-src-app-5fmarketing-locale-page-tsx"
primary_target: "apps/web/src/app/%5Fmarketing/[locale]/page.tsx"
related_targets: ["apps/web/src/components/marketing"]
---

# Marketing site (root host, /{locale}/…)

Mode: **Persuade.** Scope: home, features, pricing, about, contact, legal long-form (abuse, privacy, terms), localized 404. en/pt/es. Light and dark.

- Audience: marketing and communications teams at SMBs and publishers (desk, daylight, desktop first), plus creators on phones.
- Action: start free (app /register); secondary: pricing, docs, contact.
- Proof: Vida Económica figures (doc 21 §5) and the live demo shortener. Claims only from doc 21 §4.
- Constraints: copy lives in `messages/*/marketing.json`; prices from `packages/billing/catalog.ts`; pt/es headlines run up to 40% longer than en and must fit at 390 px; no card grids, gradients, glass or icon tiles (PRODUCT.md).
- Unattended run (owner goal 2026-10-17): the dealt lead structure was adopted without a decision page.

## Direction contract

THESIS: The page proves the mechanism and the customer before it describes anything. It refuses the category default of a centred slogan over a floating dashboard mock with a logo wall.

OWN-WORLD: The dashboard's world at display scale: brand navy fields that own whole bands (hero, proof, close), white or dark-navy reading bands between them, hairlines instead of cards, Schibsted Grotesk 800 for display and Geist for text, Geist Mono tabular figures, signal blue only for links and focus.

STORY: The visitor pastes a link and gets a working short link and QR code in the first viewport, sees 160,000+ counted clicks for a named publisher right under it, follows one link's life (print, manage, measure, automate), reads honest prices and starts free.

FIRST VIEWPORT: A full-bleed navy band. Left 7 columns: display headline (clamp 40–76 px), one-sentence body, the demo field (URL input with a Shorten button) or the Start-for-free action, and the reassurance line. Right 5 columns: a "link object" panel showing short link, destination and QR, labelled Example until the visitor makes their own. At the band's foot, the Vida Económica figures run as a hairline-separated strip of large tabular numerals. Mobile stacks headline, field, link object, and the figures in a two-by-two grid.

FORM: Proof-led hero with a live link object (structure 4 of 7 on the ranked list; seed 4ea5edc6). Signature interaction: on submit the link object swaps from the example to the visitor's link, the key types in and the QR resolves in place; reduced motion swaps instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
