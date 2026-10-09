import type { Db } from "mongodb";
import { z } from "zod";
import type { Documents } from "./schemas";
export const defaultPhysicalNames = {
  links: "urlv3",
  qr_codes: "qrcodesv2",
  click_events: "click_events",
  click_rollups: "click_rollups",
  workspaces: "workspaces",
  workspace_members: "workspace_members",
  tags: "tags",
  campaigns: "campaigns",
  bio_pages: "biopages",
  bio_aliases: "bio_aliases",
  domains: "domains",
  subscriptions: "subscriptions",
  usage_periods: "usage_periods",
  api_keys: "api_keys",
  clicks: "clicks",
  link_reports: "linkreports",
  scheduled_changes: "scheduledchanges",
  contacts: "contacts",
  rate_limits: "ratelimits",
  user: "user",
  session: "session",
  account: "account",
  verification: "verification",
  admin_audit_log: "admin_audit_log",
  meta: "_meta",
  login_records: "loginrecords",
};
export type PhysicalNames = typeof defaultPhysicalNames;
export function resolvePhysicalNames(json?: string): PhysicalNames {
  const overrides = json
    ? z
        .record(z.string(), z.string().regex(/^[a-zA-Z0-9_-]+$/))
        .parse(JSON.parse(json))
    : {};
  for (const key of Object.keys(overrides))
    if (!Object.hasOwn(defaultPhysicalNames, key))
      throw new Error(`Unknown physical collection key: ${key}`);
  const names = { ...defaultPhysicalNames, ...overrides };
  if (new Set(Object.values(names)).size !== Object.keys(names).length)
    throw new Error("Physical collection names must be distinct");
  return names;
}
export const physicalNames = resolvePhysicalNames(
  process.env.MONGODB_PHYSICAL_NAMES,
);
export const legacyCollectionKeys = [
  "links",
  "qr_codes",
  "clicks",
  "bio_pages",
  "campaigns",
  "tags",
  "link_reports",
  "scheduled_changes",
  "contacts",
  "rate_limits",
  "user",
  "session",
  "account",
  "verification",
  "admin_audit_log",
  "meta",
  "login_records",
] as const;
export function collection<K extends keyof Documents>(db: Db, name: K) {
  return db.collection<Documents[K]>(physicalNames[name]);
}
