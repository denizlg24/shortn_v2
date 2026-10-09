import type { Db } from "mongodb";
import type { Documents } from "./schemas";
export const physicalNames = {
  links: "urlv3s",
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
};
export function collection<K extends keyof Documents>(db: Db, name: K) {
  return db.collection<Documents[K]>(physicalNames[name]);
}
