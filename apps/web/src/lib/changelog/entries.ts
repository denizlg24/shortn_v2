import {
  minimumPlanFor,
  type Feature,
  type PlanId,
} from "@shortn/billing/catalog";

/**
 * The product changelog. Copy lives in messages under
 * `changelog.entries.<entry id>` (`sections.<id>`, `items.<id>.title|body`,
 * `highlights.<id>.title|body`); this file holds structure only, so every
 * locale renders the same sections, items and plan tags. Item ids are unique
 * within an entry. Newest entry first.
 */

/** Paid plan an item needs, or the custom-domain add-on. */
export type ChangelogTag = Exclude<PlanId, "free"> | "addon";

export interface ChangelogItem {
  readonly id: string;
  /** A catalog feature: the item is tagged with the cheapest plan that has it. */
  readonly feature?: Feature;
  /** For what the catalog doesn't list as a feature: SSO, the domain add-on. */
  readonly tag?: ChangelogTag;
}

export interface ChangelogSection {
  readonly id: string;
  readonly items: readonly ChangelogItem[];
}

export interface ChangelogEntry {
  readonly id: string;
  /** Release day, ISO `YYYY-MM-DD`. */
  readonly date: string;
  /** The few items the What's new dialog shows, in order. */
  readonly highlights: readonly string[];
  readonly sections: readonly ChangelogSection[];
}

export const changelog = [
  {
    id: "2026-10-bio-styles",
    date: "2026-10-23",
    highlights: ["bioStyles", "bioOrder", "bioImages"],
    sections: [
      {
        id: "bio",
        items: [
          { id: "linkStyles" },
          { id: "themes" },
          { id: "profileLayouts" },
          { id: "order" },
          { id: "quickImage" },
          { id: "addWithImage" },
        ],
      },
    ],
  },
  {
    id: "2026-10-bio-newest-first",
    date: "2026-10-23",
    highlights: ["bioNewest"],
    sections: [{ id: "bio", items: [{ id: "newestFirst" }] }],
  },
  {
    id: "2026-10-bio-sorting-feedback",
    date: "2026-10-23",
    highlights: ["feedback"],
    sections: [
      {
        id: "feedback",
        items: [{ id: "sendFeedback" }, { id: "feedbackStatus" }],
      },
    ],
  },
  {
    id: "2026-10-new-shortn",
    date: "2026-10-18",
    highlights: ["dashboard", "links", "qr", "bio", "developers"],
    sections: [
      {
        id: "dashboard",
        items: [
          { id: "home" },
          { id: "pages" },
          { id: "library" },
          { id: "keyboard" },
          { id: "languages" },
        ],
      },
      {
        id: "links",
        items: [
          { id: "customKeys", feature: "customKeys" },
          { id: "tags" },
          { id: "utm", feature: "campaigns" },
          { id: "password", feature: "passwords" },
          { id: "rules" },
          { id: "appLinks" },
          { id: "preview" },
          { id: "health" },
          { id: "archive" },
        ],
      },
      {
        id: "qr",
        items: [
          { id: "dynamic" },
          { id: "design" },
          { id: "logo", feature: "qrLogo" },
          { id: "qrExports" },
          { id: "scans" },
        ],
      },
      {
        id: "bio",
        items: [
          { id: "address" },
          { id: "blocks" },
          { id: "collections" },
          { id: "drafts" },
        ],
      },
      {
        id: "analytics",
        items: [
          { id: "overview" },
          { id: "breakdowns", feature: "analyticsBreakdowns" },
          { id: "analyticsExports", feature: "csvExport" },
        ],
      },
      {
        id: "campaigns",
        items: [
          { id: "campaigns", feature: "campaigns" },
          { id: "campaignExports", feature: "campaignExport" },
        ],
      },
      {
        id: "domains",
        items: [{ id: "domains", tag: "addon" }],
      },
      {
        id: "team",
        items: [{ id: "workspaces" }, { id: "roles" }],
      },
      {
        id: "developers",
        items: [
          { id: "api", feature: "api" },
          { id: "webhooks" },
          { id: "mcp", feature: "mcp" },
        ],
      },
      {
        id: "data",
        items: [
          { id: "imports" },
          { id: "linkExports", feature: "csvExport" },
          { id: "workspaceExport" },
        ],
      },
      {
        id: "security",
        items: [
          { id: "twoFactor" },
          { id: "sso", tag: "enterprise" },
          { id: "sessions" },
        ],
      },
      {
        id: "billing",
        items: [{ id: "plans" }, { id: "invoices" }, { id: "currency" }],
      },
    ],
  },
] as const satisfies readonly ChangelogEntry[];

export type ChangelogEntryId = (typeof changelog)[number]["id"];

export const latestEntry = changelog[0];

export type ChangelogHighlightId =
  (typeof changelog)[number]["highlights"][number];

export function itemTag(item: ChangelogItem): ChangelogTag | null {
  if (item.tag) return item.tag;
  if (!item.feature) return null;
  const plan = minimumPlanFor(item.feature);
  return plan === "free" ? null : plan;
}
