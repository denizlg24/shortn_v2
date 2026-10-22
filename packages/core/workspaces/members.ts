import { loadEntitlements } from "@shortn/billing";
import { collection, physicalNames, type Documents } from "@shortn/db";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { fail, ok, type Result } from "../result";
import { can, type Role } from "./authz";
import { nowOf, type ServiceContext } from "./context";
import { workspaceReadOnly } from "./status";
import {
  defaultLinkDomain,
  type UserIdentity,
  type Workspace,
} from "./service";

type Invite = Documents["workspace_invites"];

export type MemberError =
  | "forbidden"
  | "not_found"
  | "seats_exhausted"
  | "already_member"
  | "invalid_email"
  | "invite_invalid"
  | "invite_email_mismatch"
  | "owner_protected"
  | "slug_taken"
  | "invalid_slug"
  | "limit_reached"
  | "not_empty"
  | "workspace_locked";

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  joinedAt: string;
}

export interface InviteView {
  id: string;
  email: string;
  role: Invite["role"];
  invitedBy: string;
  expiresAt: string;
}

const inviteTtlMs = 7 * 86_400_000;
export const hashInviteToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function users(db: Db, ids: string[]) {
  const objectIds = ids.flatMap((id) =>
    ObjectId.isValid(id) ? [new ObjectId(id)] : [],
  );
  const docs = await db
    .collection(physicalNames.user)
    .find(
      { _id: { $in: objectIds } },
      { projection: { name: 1, email: 1, image: 1 } },
    )
    .toArray();
  return new Map(docs.map((doc) => [doc._id.toHexString(), doc]));
}

export async function listMembers(
  ctx: Pick<ServiceContext, "db" | "workspace">,
): Promise<MemberView[]> {
  const members = await collection(ctx.db, "workspace_members")
    .find({ workspaceId: ctx.workspace._id })
    .toArray();
  const byId = await users(
    ctx.db,
    members.map((member) => member.userId),
  );
  const order: Record<Role, number> = {
    owner: 0,
    admin: 1,
    member: 2,
    viewer: 3,
  };
  return members
    .map((member) => {
      const user = byId.get(member.userId);
      return {
        userId: member.userId,
        name: typeof user?.name === "string" ? user.name : "",
        email: typeof user?.email === "string" ? user.email : "",
        image: typeof user?.image === "string" ? user.image : null,
        role: member.role,
        joinedAt: (member.createdAt ?? member._id.getTimestamp()).toISOString(),
      };
    })
    .sort(
      (a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name),
    );
}

export async function listInvites(
  ctx: Pick<ServiceContext, "db" | "workspace" | "now">,
): Promise<InviteView[]> {
  const invites = await collection(ctx.db, "workspace_invites")
    .find({
      workspaceId: ctx.workspace._id,
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: nowOf(ctx) },
    })
    .toArray();
  return invites.map((invite) => ({
    id: invite._id.toHexString(),
    email: invite.email,
    role: invite.role,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt.toISOString(),
  }));
}

// Pending invites hold a seat (05 §Seats). A re-invite replaces the
// address's pending invite, so that one doesn't count against itself.
async function seatsUsed(ctx: ServiceContext, reinvited: string) {
  const [members, invites] = await Promise.all([
    collection(ctx.db, "workspace_members").countDocuments({
      workspaceId: ctx.workspace._id,
    }),
    listInvites(ctx),
  ]);
  return (
    members + invites.filter((invite) => invite.email !== reinvited).length
  );
}

export async function inviteMember(
  ctx: ServiceContext,
  input: { email: string; role: Invite["role"] },
): Promise<Result<{ invite: InviteView; token: string }, MemberError>> {
  if (!can(ctx.actor, "members.manage")) return fail("forbidden");
  const email = normalizeEmail(input.email);
  if (!emailPattern.test(email)) return fail("invalid_email");
  // Admins can't create peers of their own rank or above.
  if (input.role === "admin" && ctx.actor.role !== "owner")
    return fail("forbidden");
  const existingUser = await ctx.db
    .collection(physicalNames.user)
    .findOne({ email }, { projection: { _id: 1 } });
  if (
    existingUser &&
    (await collection(ctx.db, "workspace_members").findOne({
      workspaceId: ctx.workspace._id,
      userId: existingUser._id.toHexString(),
    }))
  )
    return fail("already_member");
  const entitlements = await loadEntitlements(ctx.db, ctx.workspace);
  const seats = entitlements.limits.seats;
  if (seats !== null && (await seatsUsed(ctx, email)) >= seats)
    return fail("seats_exhausted", { seats });
  const now = nowOf(ctx);
  await collection(ctx.db, "workspace_invites").updateMany(
    {
      workspaceId: ctx.workspace._id,
      email,
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
    },
    { $set: { revokedAt: now } },
  );
  const token = randomBytes(32).toString("base64url");
  const invite = {
    _id: new ObjectId(),
    workspaceId: ctx.workspace._id,
    email,
    role: input.role,
    tokenHash: hashInviteToken(token),
    invitedBy: ctx.actor.userId,
    expiresAt: new Date(now.getTime() + inviteTtlMs),
    createdAt: now,
    updatedAt: now,
  };
  await collection(ctx.db, "workspace_invites").insertOne(invite);
  return ok({
    invite: {
      id: invite._id.toHexString(),
      email,
      role: invite.role,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt.toISOString(),
    },
    token,
  });
}

export async function revokeInvite(
  ctx: ServiceContext,
  id: string,
): Promise<Result<null, MemberError>> {
  if (!can(ctx.actor, "members.remove")) return fail("forbidden");
  if (!ObjectId.isValid(id)) return fail("not_found");
  await collection(ctx.db, "workspace_invites").updateOne(
    {
      _id: new ObjectId(id),
      workspaceId: ctx.workspace._id,
      acceptedAt: { $exists: false },
    },
    { $set: { revokedAt: nowOf(ctx) } },
  );
  return ok(null);
}

export async function findInvite(db: Db, token: string, now = new Date()) {
  const invite = await collection(db, "workspace_invites").findOne({
    tokenHash: hashInviteToken(token),
    acceptedAt: { $exists: false },
    revokedAt: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (!invite) return null;
  const workspace = await collection(db, "workspaces").findOne({
    _id: invite.workspaceId,
  });
  return workspace ? { invite, workspace } : null;
}

// The invite is bound to its address: accepting needs a session whose
// email matches, so a forwarded link can't be used by someone else.
export async function acceptInvite(
  db: Db,
  token: string,
  user: { id: string; email: string },
  now = new Date(),
): Promise<Result<Workspace, MemberError>> {
  const found = await findInvite(db, token, now);
  if (!found) return fail("invite_invalid");
  if (normalizeEmail(user.email) !== found.invite.email)
    return fail("invite_email_mismatch");
  // Nobody joins a workspace under a staff lock or suspension; the invite
  // stays pending so it works again once the workspace is restored.
  if (workspaceReadOnly(found.workspace)) return fail("workspace_locked");
  const claimed = await collection(db, "workspace_invites").findOneAndUpdate(
    { _id: found.invite._id, acceptedAt: { $exists: false } },
    { $set: { acceptedAt: now, updatedAt: now } },
  );
  if (!claimed) return fail("invite_invalid");
  await collection(db, "workspace_members").updateOne(
    { workspaceId: found.workspace._id, userId: user.id },
    {
      $setOnInsert: {
        workspaceId: found.workspace._id,
        userId: user.id,
        role: found.invite.role,
        invitedBy: found.invite.invitedBy,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  return ok(found.workspace);
}

export async function changeRole(
  ctx: ServiceContext,
  userId: string,
  role: Exclude<Role, "owner">,
): Promise<Result<null, MemberError>> {
  if (!can(ctx.actor, "members.manage")) return fail("forbidden");
  const member = await collection(ctx.db, "workspace_members").findOne({
    workspaceId: ctx.workspace._id,
    userId,
  });
  if (!member) return fail("not_found");
  if (member.role === "owner") return fail("owner_protected");
  if (
    (member.role === "admin" || role === "admin") &&
    ctx.actor.role !== "owner"
  )
    return fail("forbidden");
  await collection(ctx.db, "workspace_members").updateOne(
    { _id: member._id },
    { $set: { role, updatedAt: nowOf(ctx) } },
  );
  return ok(null);
}

// Anyone may leave; removing someone else needs members.manage, and only
// the owner removes admins. The owner can't be removed.
export async function removeMember(
  ctx: ServiceContext,
  userId: string,
): Promise<Result<null, MemberError>> {
  const member = await collection(ctx.db, "workspace_members").findOne({
    workspaceId: ctx.workspace._id,
    userId,
  });
  if (!member) return fail("not_found");
  if (member.role === "owner") return fail("owner_protected");
  const self = userId === ctx.actor.userId;
  if (!self && !can(ctx.actor, "members.remove")) return fail("forbidden");
  if (!self && member.role === "admin" && ctx.actor.role !== "owner")
    return fail("forbidden");
  await collection(ctx.db, "workspace_members").deleteOne({ _id: member._id });
  return ok(null);
}

export const workspaceSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
const reservedSlugs = new Set([
  "login",
  "register",
  "recover",
  "reset",
  "verify",
  "handoff",
  "invite",
  "api",
  "onboarding",
  "new",
  "settings",
  "account",
  "_next",
  "static",
  "authenticate",
  "safety",
  "en",
  "pt",
  "es",
  "admin",
]);

async function checkWorkspaceSlug(db: Db, raw: string, except?: ObjectId) {
  const slug = raw.trim().toLowerCase();
  if (!workspaceSlugPattern.test(slug) || reservedSlugs.has(slug))
    return fail("invalid_slug");
  const clash = await collection(db, "workspaces").findOne({
    slug,
    ...(except ? { _id: { $ne: except } } : {}),
  });
  return clash ? fail("slug_taken") : ok(slug);
}

// Extra workspaces are a paid entitlement of the creator's personal plan.
export async function createWorkspace(
  db: Db,
  user: UserIdentity,
  input: { name: string; slug: string },
  now = new Date(),
): Promise<Result<Workspace, MemberError>> {
  const personal = await collection(db, "workspaces").findOne({
    ownerUserId: user.id,
    personal: true,
  });
  if (!personal) return fail("not_found");
  const entitlements = await loadEntitlements(db, personal);
  const limit = entitlements.limits.workspaces;
  if (limit !== null) {
    const owned = await collection(db, "workspaces").countDocuments({
      ownerUserId: user.id,
    });
    if (owned >= limit) return fail("limit_reached", { limit });
  }
  const slug = await checkWorkspaceSlug(db, input.slug);
  if (!slug.ok) return slug;
  const workspace: Workspace = {
    _id: new ObjectId(),
    slug: slug.value,
    name: input.name.trim().slice(0, 64) || slug.value,
    ownerUserId: user.id,
    personal: false,
    plan: "free",
    addOns: [],
    defaultDomain: defaultLinkDomain,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await collection(db, "workspaces").insertOne(workspace);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("slug_taken");
    throw error;
  }
  await collection(db, "workspace_members").insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    userId: user.id,
    role: "owner",
    createdAt: now,
    updatedAt: now,
  });
  return ok(workspace);
}

export async function updateWorkspace(
  ctx: ServiceContext,
  input: { name?: string | undefined; slug?: string | undefined },
): Promise<Result<Workspace, MemberError>> {
  if (!can(ctx.actor, "workspace.update")) return fail("forbidden");
  const set: Partial<Workspace> = { updatedAt: nowOf(ctx) };
  if (input.name?.trim()) set.name = input.name.trim().slice(0, 64);
  if (
    input.slug !== undefined &&
    input.slug.trim().toLowerCase() !== ctx.workspace.slug
  ) {
    const slug = await checkWorkspaceSlug(
      ctx.db,
      input.slug,
      ctx.workspace._id,
    );
    if (!slug.ok) return slug;
    set.slug = slug.value;
  }
  const updated = await collection(ctx.db, "workspaces").findOneAndUpdate(
    { _id: ctx.workspace._id },
    { $set: set },
    { returnDocument: "after" },
  );
  return updated ? ok(updated) : fail("not_found");
}

// Only an empty team workspace can be deleted here; personal workspaces go
// with the account (05 §Account lifecycle).
export async function deleteWorkspace(
  ctx: ServiceContext,
): Promise<Result<null, MemberError>> {
  if (!can(ctx.actor, "workspace.delete") || ctx.workspace.personal)
    return fail("forbidden");
  const scope = { workspaceId: ctx.workspace._id };
  const counts = await Promise.all(
    (["links", "qr_codes", "bio_pages", "campaigns"] as const).map((name) =>
      ctx.db
        .collection(physicalNames[name])
        .countDocuments(scope, { limit: 1 }),
    ),
  );
  const paid = await collection(ctx.db, "subscriptions").countDocuments({
    ...scope,
    status: { $in: ["active", "trialing", "past_due"] },
  });
  if (counts.some(Boolean) || paid) return fail("not_empty");
  await Promise.all([
    collection(ctx.db, "workspace_members").deleteMany(scope),
    collection(ctx.db, "workspace_invites").deleteMany(scope),
    collection(ctx.db, "tags").deleteMany(scope),
  ]);
  await collection(ctx.db, "workspaces").deleteOne({ _id: ctx.workspace._id });
  return ok(null);
}
