import { ObjectId, type Db } from "mongodb";
import { physicalNames } from "./collections";

/** Shared by new-app, legacy and MCP validators. Ordinary sessions remain valid;
 * SSO-bound sessions must retain their exact provider, account and current tenant
 * authority. Read projections deliberately exclude encrypted configuration.
 */
export async function ssoSessionActive(
  db: Db,
  session: { ssoProviderId?: unknown; ssoWorkspaceId?: unknown },
  userId: string,
) {
  if (session.ssoProviderId == null && session.ssoWorkspaceId == null)
    return true;
  const validId = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
  if (
    !validId(session.ssoProviderId) ||
    !validId(session.ssoWorkspaceId) ||
    !validId(userId)
  )
    return false;
  const workspaceId = new ObjectId(session.ssoWorkspaceId),
    userIds = [userId, new ObjectId(userId)];
  const provider = await db
    .collection(physicalNames.sso_providers)
    .findOne(
      {
        _id: new ObjectId(session.ssoProviderId),
        workspaceId,
        domainVerified: true,
      },
      { projection: { providerId: 1, identityIssuer: 1 } },
    );
  if (
    !provider ||
    typeof provider.providerId !== "string" ||
    typeof provider.identityIssuer !== "string"
  )
    return false;
  const binding = await db
    .collection(physicalNames.sso_bindings)
    .findOne(
      {
        providerRecordId: String(provider._id),
        providerId: provider.providerId,
        workspaceId,
        issuer: provider.identityIssuer,
        userId: { $in: userIds },
      },
      { projection: { subject: 1 } },
    );
  if (!binding || typeof binding.subject !== "string") return false;
  const [workspace, member, subscription, account] = await Promise.all([
    db
      .collection(physicalNames.workspaces)
      .findOne(
        {
          _id: workspaceId,
          personal: false,
          "platformFeatures.advancedAuth": true,
        },
        { projection: { _id: 1 } },
      ),
    db
      .collection(physicalNames.workspace_members)
      .findOne(
        {
          workspaceId,
          userId,
          role: { $in: ["owner", "admin", "member", "viewer"] },
        },
        { projection: { _id: 1 } },
      ),
    db
      .collection(physicalNames.subscriptions)
      .findOne(
        {
          workspaceId,
          plan: "enterprise",
          status: { $in: ["active", "trialing", "past_due"] },
        },
        { projection: { _id: 1 } },
      ),
    db
      .collection(physicalNames.account)
      .findOne(
        {
          userId: { $in: userIds },
          providerId: provider.providerId,
          accountId: binding.subject,
        },
        { projection: { _id: 1 } },
      ),
  ]);
  return Boolean(workspace && member && subscription && account);
}
