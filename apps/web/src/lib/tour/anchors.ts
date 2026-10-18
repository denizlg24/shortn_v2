/**
 * Elements the product tour points at. Spread `tourAnchor(id)` onto the real
 * element instead of anchoring the tour to class names; the tour registry
 * test checks every id below is rendered somewhere in src.
 */
export const tourAnchors = [
  "links-library",
  "links-filters",
  "links-new",
  "link-key",
  "link-password",
  "link-advanced",
  "link-tabs",
  "qr-library",
  "qr-preview",
  "qr-logo",
  "bio-toolbar",
  "analytics-chart",
  "analytics-breakdowns",
  "campaigns-list",
  "imports-upload",
  "domains-add",
  "members-list",
  "api-keys-create",
  "webhooks-endpoints",
  "security-two-factor",
  "billing-plan",
  "help-menu",
] as const;

export type TourAnchor = (typeof tourAnchors)[number];

export const tourAnchor = (id: TourAnchor) => ({ "data-tour": id }) as const;

export const tourSelector = (id: TourAnchor) => `[data-tour="${id}"]`;
