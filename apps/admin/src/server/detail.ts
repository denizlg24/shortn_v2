import "server-only";
import { physicalNames } from "@shortn/db";
import { ObjectId, type Document } from "mongodb";
export type DetailTab = {
  label: string;
  collection: string;
  filter: Document;
  fields: [string, string][];
};
export function detailTabs(
  area: string,
  row: Document,
): Record<string, DetailTab> {
  const id = row._id as ObjectId;
  const userId = String(id);
  const both = { $in: [id, userId] };
  const workspace = { workspaceId: id };
  if (area === "users")
    return {
      workspaces: {
        label: "Workspaces",
        collection: physicalNames.workspace_members,
        filter: { userId },
        fields: [
          ["workspaceId", "Workspace"],
          ["role", "Role"],
          ["createdAt", "Joined"],
        ],
      },
      sessions: {
        label: "Sessions",
        collection: physicalNames.session,
        filter: { userId: both },
        fields: [
          ["createdAt", "Created"],
          ["expiresAt", "Expires"],
          ["ipAddress", "IP"],
          ["userAgent", "User agent"],
          ["impersonatedBy", "Impersonated by"],
        ],
      },
      security: {
        label: "Connected accounts",
        collection: physicalNames.account,
        filter: { userId: both },
        fields: [
          ["providerId", "Provider"],
          ["createdAt", "Connected"],
        ],
      },
      passkeys: {
        label: "Passkeys",
        collection: physicalNames.passkeys,
        filter: { userId: both },
        fields: [
          ["name", "Name"],
          ["createdAt", "Created"],
          ["lastUsedAt", "Last used"],
        ],
      },
      sso: {
        label: "SSO bindings",
        collection: physicalNames.sso_bindings,
        filter: { userId: both },
        fields: [
          ["workspaceId", "Workspace"],
          ["providerId", "Provider"],
          ["createdAt", "Created"],
        ],
      },
      grants: {
        label: "MCP consents",
        collection: physicalNames.oauth_consents,
        filter: { userId: both },
        fields: [
          ["clientId", "Client"],
          ["scopes", "Scopes"],
          ["createdAt", "Created"],
          ["updatedAt", "Updated"],
        ],
      },
      tokens: {
        label: "MCP grants",
        collection: physicalNames.oauth_access_tokens,
        filter: { userId: both },
        fields: [
          ["clientId", "Client"],
          ["scopes", "Scopes"],
          ["createdAt", "Created"],
          ["expiresAt", "Expires"],
        ],
      },
      legacy: {
        label: "Legacy sign-ins",
        collection: physicalNames.login_records,
        filter: row.sub ? { sub: row.sub } : { _id: { $in: [] } },
        fields: [
          ["date", "Time"],
          ["createdAt", "Recorded"],
          ["ip", "IP"],
          ["country", "Country"],
          ["userAgent", "User agent"],
        ],
      },
      history: {
        label: "Sign-in history",
        collection: physicalNames.sign_in_events,
        filter: { userId },
        fields: [
          ["at", "Time"],
          ["method", "Method"],
          ["ip", "IP"],
          ["country", "Country"],
        ],
      },
      audit: {
        label: "Admin audit",
        collection: physicalNames.admin_audit_log,
        filter: {
          $or: [{ targetType: "user", targetId: userId }, { actorId: userId }],
        },
        fields: [
          ["createdAt", "Time"],
          ["actorEmail", "Actor"],
          ["action", "Action"],
          ["reason", "Reason"],
          ["status", "Status"],
        ],
      },
      contacts: {
        label: "Contacts",
        collection: physicalNames.contacts,
        filter: { email: row.email },
        fields: [
          ["createdAt", "Received"],
          ["subject", "Subject"],
          ["message", "Message"],
          ["triage.status", "Status"],
        ],
      },
    };
  if (area === "workspaces")
    return {
      members: {
        label: "Members",
        collection: physicalNames.workspace_members,
        filter: workspace,
        fields: [
          ["userId", "User"],
          ["role", "Role"],
          ["createdAt", "Joined"],
        ],
      },
      invites: {
        label: "Invites",
        collection: physicalNames.workspace_invites,
        filter: workspace,
        fields: [
          ["email", "Email"],
          ["role", "Role"],
          ["expiresAt", "Expires"],
        ],
      },
      billing: {
        label: "Billing",
        collection: physicalNames.subscriptions,
        filter: workspace,
        fields: [
          ["plan", "Plan"],
          ["status", "Status"],
          ["currentPeriodEnd", "Period end"],
          ["polarSubscriptionId", "Polar ID"],
        ],
      },
      domains: {
        label: "Domains",
        collection: physicalNames.domains,
        filter: workspace,
        fields: [
          ["hostname", "Hostname"],
          ["status", "Status"],
          ["sslStatus", "SSL"],
        ],
      },
      keys: {
        label: "API keys",
        collection: physicalNames.api_keys,
        filter: workspace,
        fields: [
          ["name", "Name"],
          ["prefix", "Prefix"],
          ["scopes", "Scopes"],
          ["lastUsedAt", "Last used"],
          ["revokedAt", "Revoked"],
        ],
      },
      webhooks: {
        label: "Webhooks",
        collection: physicalNames.webhook_endpoints,
        filter: workspace,
        fields: [
          ["name", "Name"],
          ["url", "URL"],
          ["enabled", "Enabled"],
        ],
      },
      links: {
        label: "Links",
        collection: physicalNames.links,
        filter: workspace,
        fields: [
          ["key", "Key"],
          ["domain", "Domain"],
          ["longUrl", "Destination"],
          ["safetyStatus", "Safety"],
        ],
      },
      audit: {
        label: "Admin audit",
        collection: physicalNames.admin_audit_log,
        filter: workspace,
        fields: [
          ["createdAt", "Time"],
          ["actorEmail", "Actor"],
          ["action", "Action"],
          ["reason", "Reason"],
        ],
      },
      mcp: {
        label: "MCP audit",
        collection: physicalNames.audit_log,
        filter: workspace,
        fields: [
          ["createdAt", "Time"],
          ["tool", "Tool"],
          ["status", "Status"],
        ],
      },
      imports: {
        label: "Imports",
        collection: physicalNames.import_jobs,
        filter: workspace,
        fields: [
          ["kind", "Kind"],
          ["state", "State"],
          ["createdAt", "Created"],
          ["error", "Error"],
        ],
      },
      qrjobs: {
        label: "QR exports",
        collection: physicalNames.qr_export_jobs,
        filter: workspace,
        fields: [
          ["state", "State"],
          ["createdAt", "Created"],
          ["error", "Error"],
        ],
      },
      addons: {
        label: "Domain add-ons",
        collection: physicalNames.domain_addons,
        filter: workspace,
        fields: [
          ["status", "Status"],
          ["polarSubscriptionId", "Polar subscription"],
          ["currentPeriodEnd", "Period end"],
        ],
      },
      jobs: {
        label: "Exports",
        collection: physicalNames.export_jobs,
        filter: workspace,
        fields: [
          ["kind", "Kind"],
          ["state", "State"],
          ["createdAt", "Created"],
          ["error", "Error"],
        ],
      },
    };
  if (area === "links")
    return {
      reports: {
        label: "Reports",
        collection: physicalNames.link_reports,
        filter: { linkId: id },
        fields: [
          ["createdAt", "Reported"],
          ["reason", "Reason"],
          ["details", "Details"],
          ["status", "Status"],
        ],
      },
      audit: {
        label: "Audit",
        collection: physicalNames.admin_audit_log,
        filter: { targetType: "link", targetId: userId },
        fields: [
          ["createdAt", "Time"],
          ["actorEmail", "Actor"],
          ["action", "Action"],
          ["reason", "Reason"],
        ],
      },
    };
  if (area === "webhooks")
    return {
      deliveries: {
        label: "Deliveries",
        collection: physicalNames.webhook_deliveries,
        filter: { webhookId: id },
        fields: [
          ["createdAt", "Created"],
          ["event.type", "Event"],
          ["status", "Status"],
          ["attempts", "Attempts"],
          ["lastError", "Last error"],
        ],
      },
      attempts: {
        label: "Attempts",
        collection: physicalNames.webhook_attempts,
        filter: { webhookId: id },
        fields: [
          ["createdAt", "Time"],
          ["status", "HTTP status"],
          ["error", "Error"],
        ],
      },
    };
  return {};
}
