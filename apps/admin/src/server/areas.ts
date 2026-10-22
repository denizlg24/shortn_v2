import "server-only";
import { physicalNames } from "@shortn/db";

export type Area = {
  title: string;
  collection: string;
  fields: [string, string][];
  facets?: { name: string; label: string; values: string[] }[];
  search: string[];
  targetType:
    | "user"
    | "workspace"
    | "link"
    | "domain"
    | "webhook"
    | "job"
    | "contact"
    | "subscription"
    | "report"
    | "system";
  actions?: string[];
};
export const areas: Record<string, Area> = {
  users: {
    title: "Users",
    collection: physicalNames.user,
    fields: [
      ["email", "Email"],
      ["name", "Name"],
      ["role", "Role"],
      ["banned", "Banned"],
      ["emailVerified", "Verified"],
      ["twoFactorEnabled", "2FA"],
    ],
    search: ["email", "username", "sub"],
    targetType: "user",
    actions: [
      "ban",
      "unban",
      "revoke-sessions",
      "impersonate",
      "role",
      "delete",
      "cancel-deletion",
    ],
  },
  workspaces: {
    title: "Workspaces",
    collection: physicalNames.workspaces,
    fields: [
      ["name", "Name"],
      ["slug", "Slug"],
      ["ownerUserId", "Owner"],
      ["plan", "Plan"],
      ["personal", "Personal"],
      ["suspension.level", "Suspension"],
    ],
    search: ["slug"],
    facets: [
      {
        name: "plan",
        label: "Plan",
        values: ["free", "basic", "plus", "pro", "enterprise"],
      },
      {
        name: "suspension.level",
        label: "Status",
        values: ["locked", "suspended"],
      },
    ],
    targetType: "workspace",
    actions: ["lock", "suspend", "unsuspend", "override", "features"],
  },
  links: {
    title: "Links",
    collection: physicalNames.links,
    fields: [
      ["key", "Key"],
      ["domain", "Domain"],
      ["longUrl", "Destination"],
      ["workspaceId", "Workspace"],
      ["safetyStatus", "Safety"],
      ["reportCount", "Reports"],
      ["moderation.state", "Moderation"],
    ],
    search: ["urlCode", "key"],
    facets: [
      {
        name: "safetyStatus",
        label: "Safety",
        values: ["suspicious", "malicious", "blocked"],
      },
      { name: "moderation.state", label: "Moderation", values: ["taken_down"] },
    ],
    targetType: "link",
    actions: ["takedown", "restore"],
  },
  reports: {
    title: "Reports",
    collection: physicalNames.link_reports,
    fields: [
      ["linkId", "Link"],
      ["reason", "Reason"],
      ["status", "Status"],
      ["createdAt", "Reported"],
      ["details", "Details"],
    ],
    search: [],
    facets: [
      {
        name: "status",
        label: "Status",
        values: ["open", "reviewed", "dismissed"],
      },
    ],
    targetType: "report",
    actions: ["resolve", "dismiss"],
  },
  domains: {
    title: "Domains",
    collection: physicalNames.domains,
    fields: [
      ["hostname", "Hostname"],
      ["workspaceId", "Workspace"],
      ["status", "Status"],
      ["sslStatus", "SSL"],
      ["nextAttemptAt", "Next attempt"],
      ["lastError", "Last error"],
    ],
    search: ["hostname"],
    facets: [
      {
        name: "status",
        label: "Status",
        values: ["pending", "active", "failed", "suspended", "disabled"],
      },
    ],
    targetType: "domain",
    actions: ["reverify", "suspend", "unsuspend", "remove"],
  },
  webhooks: {
    title: "Webhooks",
    collection: physicalNames.webhook_endpoints,
    fields: [
      ["name", "Name"],
      ["url", "URL"],
      ["workspaceId", "Workspace"],
      ["enabled", "Enabled"],
      ["failureSince", "Failing since"],
      ["adminDisabled.reason", "Staff decision"],
    ],
    search: ["name"],
    targetType: "webhook",
    actions: ["disable", "enable", "cancel-deliveries"],
  },
  billing: {
    title: "Billing",
    collection: physicalNames.subscriptions,
    fields: [
      ["workspaceId", "Workspace"],
      ["plan", "Plan"],
      ["status", "Status"],
      ["currentPeriodEnd", "Period end"],
      ["cancelAtPeriodEnd", "Cancel at period end"],
      ["polarSubscriptionId", "Polar subscription"],
    ],
    search: ["polarSubscriptionId"],
    facets: [
      {
        name: "status",
        label: "Status",
        values: [
          "active",
          "trialing",
          "past_due",
          "canceled",
          "unpaid",
          "revoked",
        ],
      },
      {
        name: "plan",
        label: "Plan",
        values: ["basic", "plus", "pro", "enterprise"],
      },
    ],
    targetType: "subscription",
    actions: ["cancel", "uncancel", "revoke", "refund"],
  },
  jobs: {
    title: "Jobs",
    collection: physicalNames.import_jobs,
    fields: [
      ["workspaceId", "Workspace"],
      ["kind", "Kind"],
      ["state", "State"],
      ["createdAt", "Created"],
      ["leaseUntil", "Lease until"],
      ["error", "Error"],
    ],
    search: [],
    facets: [
      {
        name: "state",
        label: "State",
        values: [
          "pending",
          "queued",
          "running",
          "completed",
          "failed",
          "cancelled",
        ],
      },
    ],
    targetType: "job",
    actions: ["retry", "requeue", "cancel"],
  },
  contacts: {
    title: "Contacts",
    collection: physicalNames.contacts,
    fields: [
      ["email", "Email"],
      ["name", "Name"],
      ["subject", "Subject"],
      ["message", "Message"],
      ["triage.status", "Status"],
      ["triage.assignee", "Assignee"],
      ["createdAt", "Received"],
    ],
    search: ["email"],
    facets: [
      {
        name: "triage.status",
        label: "Status",
        values: ["new", "open", "replied", "closed", "spam"],
      },
    ],
    targetType: "contact",
    actions: ["triage"],
  },
  audit: {
    title: "Audit",
    collection: physicalNames.admin_audit_log,
    fields: [
      ["createdAt", "Time"],
      ["actorEmail", "Actor"],
      ["action", "Action"],
      ["targetType", "Target type"],
      ["targetId", "Target"],
      ["status", "Status"],
      ["reason", "Reason"],
      ["ip", "IP"],
    ],
    search: ["actorEmail", "targetId"],
    facets: [
      {
        name: "status",
        label: "Status",
        values: ["started", "succeeded", "failed"],
      },
    ],
    targetType: "system",
  },
};
export const jobCollections: Record<string, string> = {
  imports: physicalNames.import_jobs,
  exports: physicalNames.export_jobs,
  qr: physicalNames.qr_export_jobs,
  zips: physicalNames.qr_zip_jobs,
  bio: physicalNames.bio_delivery_jobs,
  webhooks: physicalNames.webhook_deliveries,
  billing: physicalNames.billing_events,
};
export function fieldValue(
  row: Record<string, unknown>,
  path: string,
): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      row,
    );
}
export function display(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && "toHexString" in value) return String(value);
  if (Array.isArray(value)) return value.map(display).join(", ");
  if (typeof value === "object") return "Recorded";
  return String(value);
}

export const areaViews: Record<
  string,
  Record<string, Area & { match?: Record<string, unknown>; sortField?: string }>
> = {
  billing: {
    subscriptions: areas.billing!,
    events: {
      title: "Billing events",
      collection: physicalNames.billing_events,
      fields: [
        ["type", "Type"],
        ["receivedAt", "Received"],
        ["processedAt", "Processed"],
        ["attempts", "Attempts"],
        ["error", "Error"],
        ["lockedUntil", "Locked until"],
      ],
      search: ["type"],
      targetType: "system",
      sortField: "receivedAt",
    },
    reconcile: {
      title: "Billing reconciliation",
      collection: physicalNames.billing_reconcile_runs,
      fields: [
        ["at", "Time"],
        ["checked", "Checked"],
        ["corrected", "Corrected"],
        ["unmapped", "Unmapped"],
        ["orphaned", "Orphaned"],
      ],
      search: [],
      targetType: "system",
      sortField: "at",
    },
    shadow: {
      title: "Historical billing differences",
      collection: physicalNames.billing_shadow_diffs,
      fields: [
        ["at", "Time"],
        ["subscriptionId", "Polar subscription"],
        ["legacyPlan", "Legacy plan"],
        ["plan", "Mirror plan"],
      ],
      search: [],
      targetType: "system",
    },
    overrides: {
      ...areas.workspaces!,
      title: "Overrides and comps",
      actions: [],
      match: { entitlementOverride: { $exists: true } },
    },
  },
};
export function areaFor(area: string, view?: string) {
  return view && areaViews[area] ? areaViews[area]?.[view] : areas[area];
}
