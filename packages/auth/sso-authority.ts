import { createHash, randomUUID } from "node:crypto";
import {
  enterpriseComp,
  entitlementOverrideSchema,
  physicalNames,
} from "@shortn/db";
import type { BetterAuthPlugin } from "better-auth";
import type {
  SSOUserResolution,
  SSOUserResolutionContext,
  SSOUserResolutionInput,
} from "@better-auth/sso";

export const ssoAuthorityModels = {
  workspace: "shortnSsoWorkspace",
  member: "shortnSsoMember",
  subscription: "shortnSsoSubscription",
  binding: "shortnSsoBinding",
  intent: "shortnSsoLinkIntent",
} as const;
export const ssoAuthorityCollections = {
  binding: physicalNames.sso_bindings,
  intent: physicalNames.sso_link_intents,
} as const;
const workspaceReference = { model: ssoAuthorityModels.workspace, field: "id" };
const userReference = { model: "user", field: "id" };

/** Read canonical collections through Better Auth's active native transaction.
 * Canonical member/owner user IDs are strings; workspace IDs are ObjectIds.
 * Declaring the former as foreign keys would silently change their storage type.
 */
export const ssoAuthoritySchema: BetterAuthPlugin = {
  id: "shortn-sso-authority-schema",
  schema: {
    user: {
      fields: {
        passkeyRemoval: {
          type: "json",
          required: false,
          input: false,
          returned: false,
        },
        shortnSsoAuthFence: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    session: {
      fields: {
        shortnSsoAuthFence: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    [ssoAuthorityModels.workspace]: {
      modelName: physicalNames.workspaces,
      fields: {
        ownerUserId: { type: "string", input: false },
        personal: { type: "boolean", input: false },
        platformFeatures: { type: "json", required: false, input: false },
        entitlementOverride: { type: "json", required: false, input: false },
        authFence: { type: "string", required: false, input: false },
      },
    },
    [ssoAuthorityModels.member]: {
      modelName: physicalNames.workspace_members,
      fields: {
        workspaceId: {
          type: "string",
          references: workspaceReference,
          input: false,
        },
        userId: { type: "string", input: false },
        role: { type: "string", input: false },
        authFence: { type: "string", required: false, input: false },
      },
    },
    [ssoAuthorityModels.subscription]: {
      modelName: physicalNames.subscriptions,
      fields: {
        workspaceId: {
          type: "string",
          references: workspaceReference,
          input: false,
        },
        plan: { type: "string", input: false },
        status: { type: "string", input: false },
        authFence: { type: "string", required: false, input: false },
      },
    },
    [ssoAuthorityModels.binding]: {
      modelName: ssoAuthorityCollections.binding,
      fields: {
        providerId: { type: "string", input: false },
        providerRecordId: { type: "string", input: false },
        workspaceId: {
          type: "string",
          references: workspaceReference,
          input: false,
        },
        issuer: { type: "string", input: false },
        subject: { type: "string", input: false },
        userId: { type: "string", references: userReference, input: false },
        createdAt: { type: "date", input: false },
      },
    },
    [ssoAuthorityModels.intent]: {
      modelName: ssoAuthorityCollections.intent,
      fields: {
        nonceHash: { type: "string", unique: true, input: false },
        providerId: { type: "string", input: false },
        providerRecordId: { type: "string", input: false },
        workspaceId: {
          type: "string",
          references: workspaceReference,
          input: false,
        },
        userId: { type: "string", references: userReference, input: false },
        sessionId: {
          type: "string",
          references: { model: "session", field: "id" },
          input: false,
        },
        expiresAt: { type: "date", input: false },
        createdAt: { type: "date", input: false },
      },
    },
  },
};
export const ssoProviderFields = {
  displayName: { type: "string" as const, required: false },
  workspaceId: {
    type: "string" as const,
    references: workspaceReference,
    required: true,
  },
  shortnSsoAuthFence: {
    type: "string" as const,
    required: false,
    input: false,
    returned: false,
  },
  identityIssuer: { type: "string" as const, required: true, input: false },
};
export const hashSsoLinkNonce = (nonce: string) =>
  createHash("sha256").update(nonce).digest("hex");
type Row = Record<string, unknown> & { id: string };
type Database = SSOUserResolutionContext["database"];
const find = (
  database: Database,
  model: string,
  fields: Record<string, string>,
) =>
  database.findOne<Row>({
    model,
    where: Object.entries(fields).map(([field, value]) => ({ field, value })),
  });
const id = (value: unknown) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value) ? value : null;
const date = (value: unknown) =>
  value instanceof Date || typeof value === "string"
    ? new Date(value).getTime()
    : NaN;
const reject = (code: string): SSOUserResolution => ({
  action: "reject",
  code,
});

export async function ssoWorkspaceOwner(
  database: Database,
  workspaceId: string,
  userId: string,
) {
  const workspace = await find(database, ssoAuthorityModels.workspace, {
    id: workspaceId,
  });
  if (
    !workspace ||
    workspace.personal !== false ||
    workspace.ownerUserId !== userId
  )
    return null;
  const member = await find(database, ssoAuthorityModels.member, {
    workspaceId,
    userId,
  });
  return member?.role === "owner" ? { workspace, member } : null;
}

export async function ssoWorkspaceAuthority(
  database: Database,
  workspaceId: string,
  userId: string,
  now = new Date(),
) {
  const workspace = await find(database, ssoAuthorityModels.workspace, {
    id: workspaceId,
  });
  const features = workspace?.platformFeatures;
  if (
    !workspace ||
    workspace.personal !== false ||
    !features ||
    typeof features !== "object" ||
    Reflect.get(features, "advancedAuth") !== true
  )
    return null;
  const member = await find(database, ssoAuthorityModels.member, {
    workspaceId,
    userId,
  });
  if (
    !member ||
    !["owner", "admin", "member", "viewer"].includes(String(member.role))
  )
    return null;
  // A staff comp to Enterprise counts like the subscription (23 §3.4). It
  // lives on the workspace row, which the authority write already fences.
  const override = entitlementOverrideSchema.safeParse(
    workspace.entitlementOverride,
  );
  if (override.success && enterpriseComp(override.data, now))
    return { workspace, member, subscription: null };
  // Match the existing billing entitlement statuses; a stale workspace.plan mirror
  // is not proof of a current Enterprise subscription.
  const subscription = await database.findOne<Row>({
    model: ssoAuthorityModels.subscription,
    where: [
      { field: "workspaceId", value: workspaceId },
      { field: "plan", value: "enterprise" },
      {
        field: "status",
        value: ["active", "trialing", "past_due"],
        operator: "in",
      },
    ],
  });
  return subscription ? { workspace, member, subscription } : null;
}

/** Called only after the upstream SAML/OIDC protocol verifier succeeds, inside
 * the same transaction as account finalization and session creation. It never
 * creates users or membership and never selects an account by email.
 */
export async function resolveWorkspaceSsoIdentity(
  input: SSOUserResolutionInput,
  { database }: SSOUserResolutionContext,
  linkNonce?: string,
  now = new Date(),
): Promise<SSOUserResolution> {
  if (input.providerReference.source.type !== "persisted")
    return reject("SSO_PROVIDER_UNAVAILABLE");
  const provider = await find(database, "ssoProvider", {
    id: input.providerReference.source.recordId,
    providerId: input.providerId,
  });
  const workspaceId = id(provider?.workspaceId);
  if (
    !provider ||
    provider.domainVerified !== true ||
    !workspaceId ||
    provider.identityIssuer !== input.accountKey.issuer
  )
    return reject("SSO_PROVIDER_UNAVAILABLE");
  const domains =
    typeof provider.domain === "string"
      ? provider.domain.split(",").map((value) => value.trim().toLowerCase())
      : [];
  const email = input.providerUser.email.toLowerCase();
  if (!domains.includes(email.slice(email.lastIndexOf("@") + 1)))
    return reject("SSO_EMAIL_DOMAIN_MISMATCH");
  const bindingKey = {
    providerRecordId: provider.id,
    issuer: input.accountKey.issuer,
    subject: input.accountKey.accountId,
  };
  const existing = await find(database, ssoAuthorityModels.binding, bindingKey);
  let userId = id(existing?.userId),
    intent: Row | null = null;
  if (linkNonce || !existing) {
    // A nonce is accepted only from the application's signed, HttpOnly linking
    // cookie, never from a callback query or a provider-controlled claim.
    if (!linkNonce || !/^[A-Za-z\d_-]{43}$/.test(linkNonce))
      return reject("SSO_ACCOUNT_NOT_CONNECTED");
    intent = await find(database, ssoAuthorityModels.intent, {
      nonceHash: hashSsoLinkNonce(linkNonce),
      providerId: input.providerId,
      providerRecordId: provider.id,
      workspaceId,
    });
    const consentingUser = id(intent?.userId);
    if (existing && consentingUser && consentingUser !== userId)
      return reject("SSO_LINK_ACCOUNT_MISMATCH");
    userId = consentingUser;
    if (
      !intent ||
      !userId ||
      date(intent.expiresAt) <= now.getTime() ||
      !Number.isFinite(date(intent.expiresAt))
    )
      return reject("SSO_LINK_EXPIRED");
    const session = await find(database, "session", {
      id: String(intent.sessionId),
      userId,
    });
    if (
      !session ||
      session.impersonatedBy ||
      date(session.expiresAt) <= now.getTime() ||
      !Number.isFinite(date(session.expiresAt)) ||
      now.getTime() - date(session.createdAt) > 300000 ||
      !Number.isFinite(date(session.createdAt))
    )
      return reject("SSO_LINK_EXPIRED");
  }
  if (!userId) return reject("SSO_ACCOUNT_NOT_CONNECTED");
  const user = await find(database, "user", { id: userId });
  const authority = await ssoWorkspaceAuthority(
    database,
    workspaceId,
    userId,
    now,
  );
  if (!user || user.emailVerified !== true || !authority)
    return reject("SSO_MEMBERSHIP_REQUIRED");
  if (
    !existing &&
    (typeof user.email !== "string" || user.email.toLowerCase() !== email)
  )
    return reject("SSO_LINK_EMAIL_MISMATCH");
  if (
    existing &&
    (existing.workspaceId !== workspaceId ||
      existing.providerId !== input.providerId)
  )
    return reject("SSO_BINDING_MISMATCH");
  // Writes fence concurrent membership removal, flag changes and entitlement
  // cancellation: a snapshot read alone could otherwise commit a stale decision.
  // A comp has no subscription row; the workspace fence covers its override.
  for (const [model, row] of [
    [ssoAuthorityModels.workspace, authority.workspace],
    [ssoAuthorityModels.member, authority.member],
    [ssoAuthorityModels.subscription, authority.subscription],
  ] as const)
    if (row)
      await database.update({
        model,
        where: [{ field: "id", value: row.id }],
        update: { authFence: randomUUID() },
      });
  await database.update({
    model: "ssoProvider",
    where: [{ field: "id", value: provider.id }],
    update: { shortnSsoAuthFence: randomUUID() },
  });
  await database.update({
    model: "user",
    where: [{ field: "id", value: userId }],
    update: { shortnSsoAuthFence: randomUUID() },
  });
  if (intent) {
    await database.update({
      model: "session",
      where: [{ field: "id", value: String(intent.sessionId) }],
      update: { shortnSsoAuthFence: randomUUID() },
    });
    await database.delete({
      model: ssoAuthorityModels.intent,
      where: [{ field: "id", value: intent.id }],
    });
    if (!existing)
      await database.create({
        model: ssoAuthorityModels.binding,
        data: {
          ...bindingKey,
          providerId: input.providerId,
          workspaceId,
          userId,
          createdAt: now,
        },
      });
  }
  return { action: "link", userId, profile: "preserve" };
}
