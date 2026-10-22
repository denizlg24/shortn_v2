import { collection, invalidateAccountStatus } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";
import { ok, fail } from "../result";
import { withMutation } from "../webhooks/events";
import { revokeUserSessions } from "./users";
import { enqueuePlatformNotification } from "./notifications";
import type { AdminContext } from "./context";

export async function deletionPreflight(db: Db, userId: ObjectId) {
  const user = await collection(db, "user").findOne({ _id: userId });
  if (!user) return null;
  const owned = await collection(db, "workspaces")
    .find({ ownerUserId: String(userId) })
    .limit(1001)
    .toArray();
  const workspaces = [];
  for (const workspace of owned.slice(0, 1000)) {
    const [members, subscriptions, domains, keys, links, qr, bio, events] =
      await Promise.all([
        collection(db, "workspace_members").countDocuments({
          workspaceId: workspace._id,
          userId: { $ne: String(userId) },
        }),
        collection(db, "subscriptions").countDocuments({
          workspaceId: workspace._id,
          status: { $in: ["active", "trialing", "past_due"] },
        }),
        collection(db, "domains").countDocuments({
          workspaceId: workspace._id,
        }),
        collection(db, "api_keys").countDocuments({
          workspaceId: workspace._id,
        }),
        collection(db, "links").countDocuments({ workspaceId: workspace._id }),
        collection(db, "qr_codes").countDocuments({
          workspaceId: workspace._id,
        }),
        collection(db, "bio_pages").countDocuments({
          workspaceId: workspace._id,
        }),
        collection(db, "click_events").countDocuments({
          "m.workspaceId": workspace._id,
        }),
      ]);
    workspaces.push({
      id: String(workspace._id),
      name: workspace.name,
      personal: workspace.personal,
      otherMembers: members,
      subscriptions,
      domains,
      keys,
      links,
      qr,
      bio,
      events,
    });
  }
  return {
    userId: String(userId),
    email: user.email,
    workspaces,
    tooMany: owned.length > 1000,
    blocked:
      owned.length > 1000 ||
      workspaces.some((w) => !w.personal && w.otherMembers > 0),
  };
}

export async function scheduleUserDeletion(
  ctx: AdminContext,
  id: ObjectId,
  confirm: string,
) {
  const report = await deletionPreflight(ctx.db, id);
  if (!report) return fail("not_found");
  if (report.email !== confirm) return fail("confirmation_required");
  if (report.blocked) return fail("transfer_shared_workspaces_first");
  const now = ctx.now();
  const purgeAfter = new Date(now.getTime() + 7 * 86400000);
  const result = await withMutation(ctx.db, async (session) => {
    const user = await collection(ctx.db, "user").findOne(
      { _id: id },
      { session },
    );
    if (!user) return fail("not_found");
    if (
      user.role === "admin" ||
      user.role === "superadmin" ||
      String(id) === ctx.admin.id
    )
      return fail("staff_protected");
    if (user.deletion) return fail("deletion_already_scheduled");
    await collection(ctx.db, "user").updateOne(
      { _id: id, deletion: { $exists: false } },
      {
        $set: {
          deletion: {
            requestedAt: now,
            by: ctx.admin.id,
            purgeAfter,
            state: "scheduled",
          },
        },
      },
      { session },
    );
    return ok({ purgeAfter, report });
  });
  if (!result.ok) return result;
  await invalidateAccountStatus(ctx.cache, String(id));
  await revokeUserSessions(ctx, String(id));

  if (report.email)
    await enqueuePlatformNotification(ctx.db, {
      key: `deletion:${id}:${now.getTime()}`,
      kind: "accountDeletionScheduled",
      to: report.email,
      payload: { purgeAfter: purgeAfter.toISOString() },
      now,
    });
  return result;
}
export async function cancelUserDeletion(ctx: AdminContext, id: ObjectId) {
  const user = await collection(ctx.db, "user").findOneAndUpdate(
    { _id: id, "deletion.state": "scheduled" },
    { $unset: { deletion: "" } },
    { returnDocument: "before" },
  );
  if (!user) return fail("deletion_not_cancellable");
  await invalidateAccountStatus(ctx.cache, String(id));

  return ok(null);
}
