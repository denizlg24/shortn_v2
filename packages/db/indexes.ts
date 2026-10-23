import { physicalNames, legacyCollectionKeys } from "./collections";
import type { PhysicalNames } from "./collections";
import { isDeepStrictEqual } from "node:util";
import type { Db, IndexDescription, IndexDescriptionInfo } from "mongodb";
export const legacyCollections = legacyCollectionKeys.map(
  (key) => physicalNames[key],
);
const imageCollections = [
  "links",
  "qr_codes",
  "bio_pages",
  "campaigns",
  "tags",
] as const;
const partial = (field: string) => ({
  partialFilterExpression: { [field]: { $type: "string" } },
});
export const desiredIndexes: Record<string, IndexDescription[]> = {
  [physicalNames.admin_bulk_selections]: [
    {
      name: "bulk_selection_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.admin_refund_intents]: [
    { name: "refund_intent_order", key: { orderId: 1, at: -1 } },
  ],
  [physicalNames.export_jobs]: [
    { name: "export_request", key: { requestKey: 1 }, unique: true },
    { name: "export_due", key: { state: 1, nextAttemptAt: 1, _id: 1 } },
    {
      name: "export_kind_due",
      key: { kind: 1, state: 1, nextAttemptAt: 1, _id: 1 },
    },
    {
      name: "export_workspace_active",
      key: { workspaceId: 1, kind: 1 },
      unique: true,
      partialFilterExpression: {
        kind: "workspace",
        state: { $in: ["pending", "running"] },
      },
    },
    {
      name: "export_mail_due",
      key: { kind: 1, emailState: 1, mailNextAt: 1, _id: 1 },
    },
    {
      name: "export_kind_workspace",
      key: { workspaceId: 1, kind: 1, _id: -1 },
    },
    { name: "export_history", key: { workspaceId: 1, createdBy: 1, _id: -1 } },
    { name: "export_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.import_jobs]: [
    { name: "import_due", key: { state: 1, nextAttemptAt: 1, _id: 1 } },
    { name: "import_workspace", key: { workspaceId: 1, _id: -1 } },
    {
      name: "import_actor_history",
      key: { workspaceId: 1, createdBy: 1, _id: -1 },
    },
    { name: "import_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.import_rows]: [
    { name: "import_source_row", key: { jobId: 1, position: 1 }, unique: true },
    {
      name: "import_source_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.import_results]: [
    {
      name: "import_result_row",
      key: { jobId: 1, generation: 1, position: 1 },
      unique: true,
    },
    {
      name: "import_valid_ordinal",
      key: { jobId: 1, generation: 1, ordinal: 1 },
    },
    {
      name: "import_result_tag",
      key: { jobId: 1, generation: 1, "input.tags": 1, position: 1 },
    },
    {
      name: "import_result_error",
      key: { jobId: 1, generation: 1, error: 1, position: 1 },
    },
    {
      name: "import_result_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.import_reservations]: [
    {
      name: "import_quota_active",
      key: {
        workspaceId: 1,
        state: 1,
        periodStart: 1,
        periodEnd: 1,
        expiresAt: 1,
      },
    },
    { name: "import_quota_purge", key: { purgeAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.import_receipts]: [
    {
      name: "import_chunk_receipt",
      key: { reservationId: 1, offset: 1 },
      unique: true,
    },
    {
      name: "import_receipt_purge",
      key: { purgeAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.qr_zip_jobs]: [
    { name: "qr_zip_request", key: { requestKey: 1 }, unique: true },
    { name: "qr_zip_due", key: { state: 1, nextAttemptAt: 1, _id: 1 } },
    { name: "qr_zip_workspace", key: { workspaceId: 1, _id: -1 } },
    { name: "qr_zip_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.qr_zip_items]: [
    { name: "qr_zip_item", key: { jobId: 1, position: 1 }, unique: true },
    {
      name: "qr_zip_item_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.qr_export_jobs]: [
    { name: "qr_export_request", key: { requestKey: 1 }, unique: true },
    { name: "qr_export_due", key: { state: 1, nextAttemptAt: 1, _id: 1 } },
    { name: "qr_export_workspace", key: { workspaceId: 1, _id: -1 } },
    { name: "qr_export_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.oauth_clients]: [
    { name: "oauth_client_id", key: { clientId: 1 }, unique: true },
  ],
  [physicalNames.oauth_resources]: [
    { name: "oauth_resource_identifier", key: { identifier: 1 }, unique: true },
  ],
  [physicalNames.two_factor]: [
    { name: "two_factor_user", key: { userId: 1 }, unique: true },
  ],
  [physicalNames.sso_providers]: [
    { name: "sso_provider_id", key: { providerId: 1 }, unique: true },
    { name: "sso_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.sso_bindings]: [
    {
      name: "sso_exact_subject",
      key: { providerRecordId: 1, issuer: 1, subject: 1 },
      unique: true,
    },
    {
      name: "sso_user_provider",
      key: { providerRecordId: 1, userId: 1 },
      unique: true,
    },
    { name: "sso_user_workspace", key: { userId: 1, workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.sso_link_intents]: [
    { name: "sso_link_nonce", key: { nonceHash: 1 }, unique: true },
    { name: "sso_link_expiry", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    { name: "sso_link_provider", key: { providerRecordId: 1 } },
  ],
  [physicalNames.passkeys]: [
    { name: "passkey_credential", key: { credentialID: 1 }, unique: true },
    { name: "passkey_user_cursor", key: { userId: 1, createdAt: -1, _id: -1 } },
  ],
  [physicalNames.oauth_client_resources]: [
    {
      name: "oauth_client_resource",
      key: { clientId: 1, resourceId: 1 },
      unique: true,
    },
  ],
  [physicalNames.oauth_consents]: [
    {
      name: "oauth_consent_grant",
      key: { clientId: 1, userId: 1, referenceId: 1 },
      unique: true,
    },
  ],
  [physicalNames.oauth_access_tokens]: [
    {
      name: "oauth_access_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.oauth_refresh_tokens]: [
    {
      name: "oauth_refresh_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.audit_log]: [
    { name: "audit_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.webhook_clicks]: [
    { name: "webhook_click_sid", key: { sid: 1 }, unique: true },
    {
      name: "webhook_click_pending",
      key: { completedAt: 1, receivedAt: 1, _id: 1 },
    },
    {
      name: "webhook_click_batch",
      key: { workspaceId: 1, type: 1, completedAt: 1, receivedAt: 1, _id: 1 },
    },
    { name: "webhook_click_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.webhook_events]: [
    { name: "webhook_event_pending", key: { completedAt: 1, _id: 1 } },
    { name: "webhook_event_id", key: { "event.id": 1 }, unique: true },
    { name: "webhook_event_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.webhook_endpoints]: [
    { name: "webhook_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
    {
      name: "webhook_subscribers",
      key: { workspaceId: 1, enabled: 1, events: 1, _id: 1 },
    },
    {
      name: "endpoint_failing",
      key: { failureSince: 1 },
      partialFilterExpression: { failureSince: { $exists: true } },
    },
  ],
  [physicalNames.webhook_deliveries]: [
    {
      name: "webhook_automatic_event",
      key: { webhookId: 1, "event.id": 1 },
      unique: true,
      partialFilterExpression: { automatic: true },
    },
    {
      name: "webhook_delivery_cursor",
      key: { workspaceId: 1, webhookId: 1, _id: -1 },
    },
    { name: "webhook_delivery_due", key: { status: 1, nextAttemptAt: 1 } },
    { name: "webhook_delivery_lease", key: { status: 1, leaseUntil: 1 } },
    {
      name: "webhook_delivery_ttl",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.webhook_attempts]: [
    {
      name: "webhook_attempt",
      key: { deliveryId: 1, attempt: 1 },
      unique: true,
    },
    {
      name: "webhook_attempt_ttl",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
    { name: "attempt_time", key: { createdAt: 1 } },
    { name: "attempt_endpoint_time", key: { webhookId: 1, createdAt: -1 } },
  ],
  [physicalNames.webhook_notifications]: [
    {
      name: "webhook_notification_due",
      key: { sentAt: 1, nextAttemptAt: 1, createdAt: 1, _id: 1 },
    },
    {
      name: "webhook_notification_endpoint",
      key: { webhookId: 1 },
      unique: true,
    },
  ],
  [physicalNames.bio_page_versions]: [
    { name: "bio_version", key: { bioPageId: 1, revision: 1 }, unique: true },
  ],
  [physicalNames.bio_delivery_jobs]: [
    { name: "bio_delivery_page", key: { bioPageId: 1 }, unique: true },
    { name: "bio_delivery_due", key: { nextAttemptAt: 1 } },
  ],
  [physicalNames.bio_views]: [
    { name: "bio_view_sid", key: { sid: 1 }, unique: true },
    {
      name: "bio_view_page_time",
      key: { workspaceId: 1, bioPageId: 1, ts: -1 },
    },
    {
      name: "bio_view_retention",
      key: { ts: 1 },
      expireAfterSeconds: 400 * 86400,
    },
  ],
  [physicalNames.domain_addons]: [
    {
      name: "domain_addon_subscription",
      key: { polarSubscriptionId: 1 },
      unique: true,
    },
    { name: "domain_addon_workspace", key: { workspaceId: 1, status: 1 } },
  ],
  [physicalNames.domain_notifications]: [
    { name: "domain_notification", key: { domainId: 1 }, unique: true },
  ],
  [physicalNames.links]: [
    {
      name: "admin_auto_blocked",
      key: { disabledReason: 1, _id: -1 },
      partialFilterExpression: { disabledReason: "auto:report-threshold" },
    },
    {
      name: "admin_risky",
      key: { safetyStatus: 1, _id: -1 },
      partialFilterExpression: {
        safetyStatus: { $in: ["suspicious", "malicious", "blocked"] },
      },
    },
    {
      name: "admin_moderated",
      key: { "moderation.at": -1, _id: -1 },
      partialFilterExpression: { moderation: { $exists: true } },
    },
    {
      name: "admin_reported",
      key: { reportCount: -1, _id: -1 },
      partialFilterExpression: { reportCount: { $gt: 0 } },
    },
    {
      name: "admin_dest_host",
      key: { destHostRev: 1, _id: -1 },
      partialFilterExpression: { destHostRev: { $type: "string" } },
    },
    {
      name: "v2_rule_schedule_due",
      key: { "ruleSchedule.queued": 1, "ruleSchedule.nextAt": 1, _id: 1 },
    },
    {
      name: "v2_rule_schedule_recover",
      key: { "ruleSchedule.queued": 1, "ruleSchedule.publishedAt": 1, _id: 1 },
    },
    ...["activeFrom", "expiresAt", "startsAt"].map((field) => ({
      name: `v2_rule_seed_${field}`,
      key: {
        "ruleSchedule.generation": 1,
        _id: 1,
        [`rules.${field}`]: 1,
      } as Record<string, 1>,
      partialFilterExpression: { [`rules.${field}`]: { $type: "date" } },
    })),
    { name: "v2_health_due", key: { "health.nextAt": 1, _id: 1 } },
    { name: "v2_health_seed", key: { "health.generation": 1, _id: 1 } },
    { name: "v2_safety_scan_due", key: { "safetyScan.dueAt": 1, _id: 1 } },
    {
      name: "v2_safety_scan_pending",
      key: { safetyStatus: 1, "safetyScan.generation": 1, _id: 1 },
    },
    {
      name: "v2_domain_key",
      key: { domain: 1, key: 1 },
      unique: true,
      ...partial("key"),
    },
    { name: "v2_legacy_code", key: { urlCode: 1 } },
    { name: "v2_previous_keys", key: { domain: 1, previousKeys: 1 } },
    {
      name: "v2_workspace_created",
      key: { workspaceId: 1, createdAt: -1, _id: -1 },
    },
    {
      name: "v2_link_trash_cleanup",
      key: { deletedAt: 1, _id: 1 },
      partialFilterExpression: { deletedAt: { $type: "date" } },
    },
    { name: "v2_workspace_tags", key: { workspaceId: 1, tagIds: 1 } },
    { name: "v2_workspace_campaign", key: { workspaceId: 1, campaignId: 1 } },
  ],
  [physicalNames.qr_codes]: [
    {
      name: "v2_public_id",
      key: { publicId: 1 },
      unique: true,
      ...partial("publicId"),
    },
    { name: "v2_qr_link", key: { linkId: 1 } },
    { name: "v2_qr_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.click_events]: [
    { name: "v2_link_time", key: { "m.linkId": 1, ts: -1 } },
    { name: "v2_workspace_time", key: { "m.workspaceId": 1, ts: -1 } },
    { name: "v2_event_sid", key: { sid: 1 } },
    { name: "v2_event_legacy_id", key: { legacyId: 1 } },
  ],
  [physicalNames.clicks]: [
    { name: "v2_click_sid", key: { sid: 1 }, ...partial("sid") },
  ],
  [physicalNames.click_ips]: [
    { name: "v2_ip_ttl", key: { ts: 1 }, expireAfterSeconds: 90 * 86_400 },
    { name: "v2_ip_sid", key: { sid: 1 }, unique: true, ...partial("sid") },
    {
      name: "v2_ip_legacy_id",
      key: { legacyId: 1 },
      unique: true,
      partialFilterExpression: { legacyId: { $type: "objectId" } },
    },
  ],
  [physicalNames.code_conflicts]: [
    { name: "v2_conflict_link", key: { linkId: 1 }, unique: true },
  ],
  [physicalNames.asset_migrations]: [
    { name: "v2_asset_source", key: { sourceUrl: 1 }, unique: true },
  ],
  [physicalNames.click_rollups]: [
    { name: "v2_link_day", key: { linkId: 1, day: 1 }, unique: true },
    { name: "v2_workspace_day", key: { workspaceId: 1, day: 1 } },
    { name: "rollup_day", key: { day: 1 } },
  ],
  [physicalNames.workspaces]: [
    { name: "v2_workspace_slug", key: { slug: 1 }, unique: true },
    {
      name: "v2_personal_owner",
      key: { ownerUserId: 1 },
      unique: true,
      partialFilterExpression: { personal: true },
    },
    { name: "v2_legacy_sub", key: { legacySub: 1 } },
    { name: "admin_plan", key: { plan: 1, _id: -1 } },
    { name: "admin_type", key: { personal: 1, _id: -1 } },
    // Also serves the redirect's suspended-set load on `suspension.level`.
    {
      name: "admin_suspended",
      key: { "suspension.level": 1, "suspension.at": -1 },
      partialFilterExpression: { "suspension.level": { $exists: true } },
    },
    {
      name: "admin_override",
      key: { "entitlementOverride.grantedAt": -1 },
      partialFilterExpression: {
        "entitlementOverride.grantedAt": { $exists: true },
      },
    },
  ],
  [physicalNames.workspace_members]: [
    { name: "v2_membership", key: { workspaceId: 1, userId: 1 }, unique: true },
    { name: "v2_member_user", key: { userId: 1 } },
  ],
  [physicalNames.handoff_tokens]: [
    { name: "v2_handoff_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  [physicalNames.billing_events]: [
    {
      name: "v2_billing_event_ttl",
      key: { receivedAt: 1 },
      expireAfterSeconds: 400 * 86_400,
    },
  ],
  // Outlives the billing_events it guards, so a replayed event never resends.
  [physicalNames.billing_mail]: [
    {
      name: "v2_billing_mail_ttl",
      key: { createdAt: 1 },
      expireAfterSeconds: 400 * 86_400,
    },
  ],
  [physicalNames.workspace_invites]: [
    { name: "v2_invite_token", key: { tokenHash: 1 }, unique: true },
    { name: "v2_invite_workspace", key: { workspaceId: 1, email: 1 } },
  ],
  [physicalNames.tags]: [
    {
      name: "v2_tag_name",
      key: { workspaceId: 1, nameLower: 1 },
      unique: true,
      ...partial("nameLower"),
    },
  ],
  [physicalNames.campaigns]: [
    { name: "v2_workspace_campaigns", key: { workspaceId: 1, createdAt: -1 } },
    { name: "v2_workspace_campaign_cursor", key: { workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.bio_pages]: [
    { name: "bio_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
    { name: "bio_legacy_cursor", key: { userId: 1, _id: -1 } },
    {
      name: "v2_bio_handle",
      key: { handle: 1 },
      unique: true,
      ...partial("handle"),
    },
    {
      name: "v2_bio_domain",
      key: { customDomain: 1 },
      unique: true,
      ...partial("customDomain"),
    },
  ],
  [physicalNames.bio_aliases]: [
    { name: "v2_bio_alias", key: { slug: 1 }, unique: true },
  ],
  [physicalNames.domains]: [
    { name: "domain_workspace_cursor", key: { workspaceId: 1, _id: -1 } },
    { name: "v2_hostname", key: { hostname: 1 }, unique: true },
    {
      name: "domain_addon_slot",
      key: { addonSubscriptionId: 1 },
      unique: true,
      ...partial("addonSubscriptionId"),
    },
    { name: "domain_poll_due", key: { nextAttemptAt: 1 } },
  ],
  [physicalNames.subscriptions]: [
    {
      name: "v2_polar_subscription",
      key: { polarSubscriptionId: 1 },
      unique: true,
    },
    { name: "v2_workspace_subscriptions", key: { workspaceId: 1, status: 1 } },
    { name: "admin_status_plan", key: { status: 1, plan: 1, _id: -1 } },
  ],
  [physicalNames.usage_periods]: [
    {
      name: "v2_workspace_period",
      key: { workspaceId: 1, period: 1 },
      unique: true,
    },
  ],
  [physicalNames.api_keys]: [
    { name: "v2_hashed_key", key: { hashedKey: 1 }, unique: true },
    { name: "v2_workspace_api_keys", key: { workspaceId: 1, _id: -1 } },
  ],
  // Platform admin (23 §2.12). A bare `{_id: -1}` key can't be partial, so the
  // flag-filtered facets lead with the flag.
  [physicalNames.user]: [
    {
      name: "admin_username",
      key: { username: 1 },
      partialFilterExpression: { username: { $type: "string" } },
    },
    {
      name: "admin_sub",
      key: { sub: 1 },
      partialFilterExpression: { sub: { $type: "string" } },
    },
    {
      name: "admin_role",
      key: { role: 1, _id: -1 },
      partialFilterExpression: { role: { $exists: true } },
    },
    {
      name: "admin_banned",
      key: { banned: 1, _id: -1 },
      partialFilterExpression: { banned: true },
    },
    {
      name: "admin_deletion",
      key: { "deletion.purgeAfter": 1 },
      partialFilterExpression: { "deletion.purgeAfter": { $exists: true } },
    },
    {
      name: "admin_2fa",
      key: { twoFactorEnabled: 1, _id: -1 },
      partialFilterExpression: { twoFactorEnabled: true },
    },
  ],
  [physicalNames.session]: [{ name: "session_user", key: { userId: 1 } }],
  [physicalNames.account]: [{ name: "account_user", key: { userId: 1 } }],
  [physicalNames.link_reports]: [
    {
      name: "report_queue",
      key: { status: 1, linkId: 1, createdAt: -1 },
    },
    { name: "report_link_ip", key: { linkId: 1, reporterIpHash: 1 } },
    { name: "report_time", key: { createdAt: -1 } },
  ],
  [physicalNames.click_rejects]: [
    { name: "reject_time", key: { at: 1 }, expireAfterSeconds: 90 * 86_400 },
  ],
  [physicalNames.billing_reconcile_runs]: [
    { name: "reconcile_time", key: { at: -1 } },
  ],
  [physicalNames.contacts]: [
    {
      name: "contact_gdpr_retention",
      key: { gdprRetainUntil: 1 },
      expireAfterSeconds: 0,
    },
    { name: "contact_triage", key: { "triage.status": 1, createdAt: -1 } },
  ],
  [physicalNames.feedback]: [
    { name: "feedback_triage", key: { "triage.status": 1, createdAt: -1 } },
    { name: "feedback_time", key: { createdAt: -1 } },
    { name: "feedback_user", key: { userId: 1, createdAt: -1 } },
  ],
  [physicalNames.admin_audit_log]: [
    { name: "admin_audit_time", key: { createdAt: -1 } },
    { name: "admin_audit_actor", key: { actorId: 1, createdAt: -1 } },
    {
      name: "admin_audit_target",
      key: { targetType: 1, targetId: 1, createdAt: -1 },
    },
    { name: "admin_audit_workspace", key: { workspaceId: 1, _id: -1 } },
  ],
  [physicalNames.admin_sessions]: [
    {
      name: "admin_session_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
    { name: "admin_session_user", key: { userId: 1 } },
  ],
  [physicalNames.admin_elevation_tokens]: [
    {
      name: "admin_elevation_expiry",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
  [physicalNames.workspace_daily]: [
    {
      name: "workspace_daily_day",
      key: { workspaceId: 1, day: 1 },
      unique: true,
    },
    { name: "workspace_daily_top", key: { day: 1, clicks: -1 } },
  ],
  [physicalNames.platform_notifications]: [
    {
      name: "platform_notification_due",
      key: { sentAt: 1, nextAttemptAt: 1, _id: 1 },
    },
  ],
  // Raw IPs are kept 90 days (as click_ips), so the whole event expires then.
  [physicalNames.sign_in_events]: [
    { name: "sign_in_user", key: { userId: 1, at: -1 } },
    { name: "sign_in_expiry", key: { at: 1 }, expireAfterSeconds: 90 * 86_400 },
  ],
};
export function equivalentIndex(
  desired: IndexDescription,
  existing: IndexDescriptionInfo,
): boolean {
  return (
    JSON.stringify(desired.key) === JSON.stringify(existing.key) &&
    Boolean(desired.unique) === Boolean(existing.unique) &&
    Boolean(desired.sparse) === Boolean(existing.sparse) &&
    isDeepStrictEqual(
      desired.partialFilterExpression ?? {},
      existing.partialFilterExpression ?? {},
    ) &&
    isDeepStrictEqual(desired.collation ?? {}, existing.collation ?? {}) &&
    desired.expireAfterSeconds === existing.expireAfterSeconds
  );
}
export async function syncIndexes(
  db: Db,
  options: {
    dryRun?: boolean;
    log?: (message: string) => void;
    physicalNames?: PhysicalNames;
  } = {},
) {
  const log = options.log ?? console.log;
  const present = await db.listCollections({}, { nameOnly: false }).toArray();
  const names = options.physicalNames ?? physicalNames;
  for (const key of legacyCollectionKeys)
    if (!present.some((item) => item.name === names[key]))
      throw new Error(
        `Missing legacy collection: ${names[key]}; refusing index sync`,
      );
  for (const [original, desired] of Object.entries(desiredIndexes)) {
    const key = Object.entries(physicalNames).find(
      ([, name]) => name === original,
    )?.[0];
    const name = key
      ? (Object.entries(names).find(([candidate]) => candidate === key)?.[1] ??
        original)
      : original;
    const info = present.find((item) => item.name === name);
    if (!info && !options.dryRun) {
      if (name === names.click_events)
        await db.createCollection(name, {
          timeseries: {
            timeField: "ts",
            metaField: "m",
            bucketMaxSpanSeconds: 86400,
            bucketRoundingSeconds: 86400,
          },
        });
      else await db.createCollection(name);
    }
    const existing = info
      ? await db.collection(name).listIndexes().toArray()
      : [];
    for (const index of desired) {
      if (existing.some((item) => equivalentIndex(index, item))) {
        log(`unchanged ${name}.${index.name}`);
        continue;
      }
      if (existing.some((item) => item.name === index.name)) {
        log(
          `conflict ${name}.${index.name}: manual review required; no drop or replacement`,
        );
        throw new Error(`Index conflict: ${name}.${index.name}`);
      }
      log(
        `${options.dryRun ? "would create" : "create"} ${name}.${index.name}`,
      );
      if (!options.dryRun) await db.collection(name).createIndexes([index]);
    }
    for (const index of existing)
      if (
        index.name !== "_id_" &&
        !desired.some((item) => equivalentIndex(item, index))
      )
        log(`drop suggestion (P7 review only): ${name}.${index.name}`);
    if (
      imageCollections.some((key) => names[key] === name) &&
      !info?.options?.changeStreamPreAndPostImages?.enabled
    ) {
      log(
        `${options.dryRun ? "would enable" : "enable"} ${name} changeStreamPreAndPostImages`,
      );
      if (!options.dryRun)
        await db.command({
          collMod: name,
          changeStreamPreAndPostImages: { enabled: true },
        });
    }
  }
}
