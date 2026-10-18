import type { StepRequirement } from "./access";
import type { TourAnchor } from "./anchors";

/** The entity a detail page needs; the tour uses the workspace's newest one. */
export type TourEntity = "link" | "qr" | "bio";

/** App routes the tour visits, as their app-directory patterns. */
export type TourPage =
  | "/[workspace]/links"
  | "/[workspace]/links/new"
  | "/[workspace]/links/[id]"
  | "/[workspace]/qr"
  | "/[workspace]/qr/[id]/design"
  | "/[workspace]/bio"
  | "/[workspace]/bio/[id]/editor"
  | "/[workspace]/analytics"
  | "/[workspace]/campaigns"
  | "/[workspace]/imports/new"
  | "/[workspace]/settings/domains"
  | "/[workspace]/settings/members"
  | "/[workspace]/settings/api-keys"
  | "/[workspace]/settings/webhooks"
  | "/[workspace]/settings/account/password"
  | "/[workspace]/settings/billing";

/** A localized user guide (`/docs/{locale}/guides/…`) or an English technical page (`/docs/…`). */
export type TourDocs =
  | { guide: string }
  | { page: "api" | "bulk-links" | "imports" | "link-rules" | "webhooks" };

export interface TourStep {
  /** Copy lives in messages under `tour.steps.<id>`. */
  readonly id: string;
  /** Where the step is shown; omitted to stay on the current page. */
  readonly page?: TourPage;
  /** Detail pages: which entity fills `[id]`, and the list to show without one. */
  readonly entity?: { readonly kind: TourEntity; readonly fallback: TourPage };
  /** The element to point at; omitted for a centered step. */
  readonly anchor?: TourAnchor;
  readonly requirement?: StepRequirement;
  readonly docs?: TourDocs;
}

export const tourSteps = [
  {
    id: "links",
    page: "/[workspace]/links",
    anchor: "links-library",
    docs: { guide: "links/managing-links" },
  },
  {
    id: "filters",
    page: "/[workspace]/links",
    anchor: "links-filters",
    docs: { page: "bulk-links" },
  },
  {
    id: "newLink",
    page: "/[workspace]/links",
    anchor: "links-new",
    docs: { guide: "links/creating-links" },
  },
  {
    id: "customKey",
    page: "/[workspace]/links/new",
    anchor: "link-key",
    requirement: { kind: "feature", feature: "customKeys" },
  },
  {
    id: "password",
    page: "/[workspace]/links/new",
    anchor: "link-password",
    requirement: { kind: "feature", feature: "passwords" },
  },
  {
    id: "rules",
    page: "/[workspace]/links/new",
    anchor: "link-advanced",
    docs: { page: "link-rules" },
  },
  {
    id: "linkPages",
    page: "/[workspace]/links/[id]",
    entity: { kind: "link", fallback: "/[workspace]/links" },
    anchor: "link-tabs",
    docs: { guide: "links/utm-parameters" },
  },
  {
    id: "qr",
    page: "/[workspace]/qr",
    anchor: "qr-library",
    docs: { guide: "qr-codes/creating-qr-codes" },
  },
  {
    id: "qrDesign",
    page: "/[workspace]/qr/[id]/design",
    entity: { kind: "qr", fallback: "/[workspace]/qr" },
    anchor: "qr-preview",
    docs: { guide: "qr-codes/managing-qr-codes" },
  },
  {
    id: "qrLogo",
    page: "/[workspace]/qr/[id]/design",
    entity: { kind: "qr", fallback: "/[workspace]/qr" },
    anchor: "qr-logo",
    requirement: { kind: "feature", feature: "qrLogo" },
  },
  {
    id: "bio",
    page: "/[workspace]/bio/[id]/editor",
    entity: { kind: "bio", fallback: "/[workspace]/bio" },
    anchor: "bio-toolbar",
    docs: { guide: "bio-pages/customizing-bio-pages" },
  },
  {
    id: "analytics",
    page: "/[workspace]/analytics",
    anchor: "analytics-chart",
    docs: { guide: "analytics/understanding-analytics" },
  },
  {
    id: "breakdowns",
    page: "/[workspace]/analytics",
    anchor: "analytics-breakdowns",
    requirement: { kind: "feature", feature: "analyticsBreakdowns" },
  },
  {
    id: "campaigns",
    page: "/[workspace]/campaigns",
    anchor: "campaigns-list",
    requirement: { kind: "feature", feature: "campaigns" },
    docs: { guide: "campaigns/organizing-campaigns" },
  },
  {
    id: "imports",
    page: "/[workspace]/imports/new",
    anchor: "imports-upload",
    docs: { page: "imports" },
  },
  {
    id: "domains",
    page: "/[workspace]/settings/domains",
    anchor: "domains-add",
    requirement: { kind: "domainAddon" },
  },
  {
    id: "members",
    page: "/[workspace]/settings/members",
    anchor: "members-list",
    requirement: { kind: "seats" },
  },
  {
    id: "apiKeys",
    page: "/[workspace]/settings/api-keys",
    anchor: "api-keys-create",
    requirement: { kind: "feature", feature: "api" },
    docs: { page: "api" },
  },
  {
    id: "webhooks",
    page: "/[workspace]/settings/webhooks",
    anchor: "webhooks-endpoints",
    docs: { page: "webhooks" },
  },
  {
    id: "security",
    page: "/[workspace]/settings/account/password",
    anchor: "security-two-factor",
  },
  {
    id: "billing",
    page: "/[workspace]/settings/billing",
    anchor: "billing-plan",
    docs: { guide: "billing/upgrading-plans" },
  },
  { id: "finish", anchor: "help-menu" },
] as const satisfies readonly TourStep[];

export type TourStepId = (typeof tourSteps)[number]["id"];

export type TourTargets = Record<TourEntity, string | null>;

/** Typed so router.push accepts it under typedRoutes. */
function pageHref(page: TourPage, workspace: string, id: string) {
  const w = encodeURIComponent(workspace),
    e = encodeURIComponent(id);
  switch (page) {
    case "/[workspace]/links":
      return `/${w}/links` as const;
    case "/[workspace]/links/new":
      return `/${w}/links/new` as const;
    case "/[workspace]/links/[id]":
      return `/${w}/links/${e}` as const;
    case "/[workspace]/qr":
      return `/${w}/qr` as const;
    case "/[workspace]/qr/[id]/design":
      return `/${w}/qr/${e}/design` as const;
    case "/[workspace]/bio":
      return `/${w}/bio` as const;
    case "/[workspace]/bio/[id]/editor":
      return `/${w}/bio/${e}/editor` as const;
    case "/[workspace]/analytics":
      return `/${w}/analytics` as const;
    case "/[workspace]/campaigns":
      return `/${w}/campaigns` as const;
    case "/[workspace]/imports/new":
      return `/${w}/imports/new` as const;
    case "/[workspace]/settings/domains":
      return `/${w}/settings/domains` as const;
    case "/[workspace]/settings/members":
      return `/${w}/settings/members` as const;
    case "/[workspace]/settings/api-keys":
      return `/${w}/settings/api-keys` as const;
    case "/[workspace]/settings/webhooks":
      return `/${w}/settings/webhooks` as const;
    case "/[workspace]/settings/account/password":
      return `/${w}/settings/account/password` as const;
    case "/[workspace]/settings/billing":
      return `/${w}/settings/billing` as const;
  }
}

export type TourHref = ReturnType<typeof pageHref>;

/**
 * The URL a step lives on, or null to stay put. A detail page without its
 * entity falls back to the list, where the step explains what's missing.
 */
export function stepHref(
  step: TourStep,
  workspace: string,
  targets: TourTargets,
): { href: TourHref; missingEntity: TourEntity | null } | null {
  if (!step.page) return null;
  const id = step.entity ? targets[step.entity.kind] : null;
  if (step.entity && !id)
    return {
      href: pageHref(step.entity.fallback, workspace, ""),
      missingEntity: step.entity.kind,
    };
  return {
    href: pageHref(step.page, workspace, id ?? ""),
    missingEntity: null,
  };
}

export function docsHref(docs: TourDocs, locale: string): string {
  return "guide" in docs
    ? `/docs/${locale}/guides/${docs.guide}`
    : `/docs/${docs.page}`;
}
