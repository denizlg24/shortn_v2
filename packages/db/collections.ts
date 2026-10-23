import type { Db } from "mongodb";
import { z } from "zod";
import type { Documents } from "./schemas";
export const defaultPhysicalNames = {
  links: "urlv3",
  qr_codes: "qrcodesv2",
  click_events: "click_events",
  click_rollups: "click_rollups",
  click_ips: "click_ips",
  click_rejects: "click_rejects",
  code_conflicts: "code_conflicts",
  asset_migrations: "asset_migrations",
  workspaces: "workspaces",
  workspace_members: "workspace_members",
  workspace_invites: "workspace_invites",
  tags: "tags",
  campaigns: "campaigns",
  bio_pages: "biopages",
  bio_aliases: "bio_aliases",
  bio_page_versions: "bio_page_versions",
  bio_delivery_jobs: "bio_delivery_jobs",
  bio_views: "bio_views",
  domain_addons: "domain_addons",
  domain_notifications: "domain_notifications",
  domains: "domains",
  subscriptions: "subscriptions",
  billing_events: "billing_events",
  billing_mail: "billing_mail",
  handoff_tokens: "handoff_tokens",
  billing_shadow_diffs: "billing_shadow_diffs",
  billing_reconcile_runs: "billing_reconcile_runs",
  usage_periods: "usage_periods",
  api_keys: "api_keys",
  audit_log: "audit_log",
  qr_export_jobs: "qr_export_jobs",
  qr_zip_jobs: "qr_zip_jobs",
  qr_zip_items: "qr_zip_items",
  legacy_quota_locks: "legacy_quota_locks",
  import_jobs: "import_jobs",
  import_rows: "import_rows",
  import_results: "import_results",
  import_reservations: "import_reservations",
  import_receipts: "import_receipts",
  export_jobs: "export_jobs",
  oauth_clients: "oauthClient",
  oauth_consents: "oauthConsent",
  oauth_access_tokens: "oauthAccessToken",
  oauth_refresh_tokens: "oauthRefreshToken",
  oauth_jwks: "jwks",
  oauth_resources: "oauthResource",
  oauth_client_resources: "oauthClientResource",
  two_factor: "twoFactor",
  passkeys: "passkey",
  sso_providers: "ssoProvider",
  sso_bindings: "shortn_sso_bindings",
  sso_link_intents: "shortn_sso_link_intents",
  webhook_clicks: "webhook_clicks",
  webhook_events: "webhook_events",
  webhook_endpoints: "webhook_endpoints",
  webhook_deliveries: "webhook_deliveries",
  webhook_attempts: "webhook_attempts",
  webhook_notifications: "webhook_notifications",
  clicks: "clicks",
  link_reports: "linkreports",
  scheduled_changes: "scheduledchanges",
  contacts: "contacts",
  feedback: "feedback",
  rate_limits: "ratelimits",
  user: "user",
  session: "session",
  account: "account",
  verification: "verification",
  admin_audit_log: "admin_audit_log",
  admin_bulk_selections: "admin_bulk_selections",
  admin_refund_intents: "admin_refund_intents",
  admin_invariants: "admin_invariants",
  admin_sessions: "admin_sessions",
  admin_elevation_tokens: "admin_elevation_tokens",
  platform_daily: "platform_daily",
  workspace_daily: "workspace_daily",
  worker_heartbeats: "worker_heartbeats",
  platform_notifications: "platform_notifications",
  sign_in_events: "sign_in_events",
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
