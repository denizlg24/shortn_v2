---
version: 1
slug: "apps-web-src-components-campaigns-campaign-link-selector-tsx"
primary_target: "apps/web/src/components/campaigns/campaign-link-selector.tsx"
related_targets: ["apps/web/src/components/campaigns/utm-builder.tsx"]
---

# Campaign link library

Mode: Operate. Narrow extension of the established Shortn application shell, typography, tokens and main Links page controls.

Request: campaign link selection must work for thousands of links, with tag filtering and grouping rather than keyword search alone. No sheets.

Direction: an inline, paginated selection step inside the UTM builder. Searchable multi-tag filters and optional tag groups precede a selection table. Selections persist across filters/pages; page/group/all-results actions remain explicit. Apply selection before saving shared UTM parameters. Keep the existing single-link preview and explain how it represents a bulk save. Operations are bounded to 500 targets; full libraries are never fetched or rendered.

Verification: root typecheck/lint/test passed. A real-browser regression seeded 1,005 tagged links plus a foreign-workspace record, checked grouping, cross-filter/page selection, 44 persisted saves, duplicate retries, the 500-link cap and foreign-target preflight. No console/page errors or dialogs; desktop and mobile controls stay within their containers and long tags do not overlap grouping. Desktop/mobile captures were inspected together. The refinement preserves the established design and introduces no global design changes.
