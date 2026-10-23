import { removeDomain } from "../domains/service";
import { scheduleUserDeletion, cancelUserDeletion } from "./deletion";
import { mutateAdminBilling, type AdminPolar } from "./billing";
import type { PolarServer } from "@shortn/billing";
import {
  collection,
  physicalNames,
  entitlementOverrideSchema,
  workspaceSuspensionSchema,
  moderationCategories,
  accountSuspension,
  feedbackStatuses,
} from "@shortn/db";
import {
  features as catalogFeatures,
  resolveEntitlements,
} from "@shortn/billing";
import { ObjectId } from "mongodb";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ok, fail, type Result } from "../result";
import { withMutation } from "../webhooks/events";
import { type AdminContext } from "./context";
import { adminDenial, type AdminAction } from "./permissions";
import { withAdminAudit } from "./audit";
import { banUser, unbanUser, revokeUserSessions } from "./users";
import { setWorkspaceSuspension } from "./workspaces";
import { takedownLink, restoreLink, clearAutoBlock } from "./links";
import { reverifyDomain, suspendDomain, unsuspendDomain } from "./domains";
import {
  adminDisableWebhook,
  adminEnableWebhook,
  cancelWebhookDeliveries,
} from "./webhooks";
import { retryJob, cancelJob, requeueStuckJob, adminJobKinds } from "./jobs";
import { enqueuePlatformNotification } from "./notifications";

export const consoleActions: Record<string, AdminAction> = {
  "users/ban": "user.ban",
  "users/unban": "user.ban",
  "users/revoke-sessions": "user.sessions.revoke",
  "users/role": "user.role.update",
  "users/impersonate": "user.impersonate",
  "workspaces/lock": "workspace.suspend",
  "workspaces/suspend": "workspace.suspend",
  "workspaces/unsuspend": "workspace.suspend",
  "workspaces/override": "workspace.override",
  "workspaces/features": "workspace.override",
  "links/takedown": "link.takedown",
  "links/restore": "link.takedown",
  "reports/resolve": "report.resolve",
  "reports/dismiss": "report.resolve",
  "domains/reverify": "domain.reverify",
  "domains/suspend": "domain.suspend",
  "domains/unsuspend": "domain.suspend",
  "domains/remove": "domain.suspend",
  "webhooks/disable": "webhook.manage",
  "webhooks/enable": "webhook.manage",
  "webhooks/cancel-deliveries": "webhook.manage",
  "jobs/retry": "job.manage",
  "jobs/requeue": "job.manage",
  "jobs/cancel": "job.manage",
  "contacts/triage": "contact.triage",
  "feedback/triage": "feedback.triage",
  "billing/cancel": "subscription.cancel",
  "billing/uncancel": "subscription.cancel",
  "billing/revoke": "subscription.revoke",
  "billing/refund": "subscription.revoke",
  "users/delete": "user.delete",
  "users/cancel-deletion": "user.delete",
};
const text = (data: Record<string, string>, key: string) =>
  (data[key] ?? "").trim();
/** Audited, server-enforced console actions. All inputs are untrusted. */
export async function consoleMutation(
  ctx: AdminContext,
  area: string,
  id: string,
  operation: string,
  data: Record<string, string>,
  reason: string,
  billing?: { polar: AdminPolar; server: PolarServer },
) {
  const permission = consoleActions[`${area}/${operation}`];
  if (!permission) return fail("invalid_action");
  const denial = adminDenial(
    { role: ctx.admin.role, elevatedAt: ctx.session.elevatedAt },
    permission,
    { reason, now: ctx.now() },
  );
  if (denial) return fail(denial);
  if (area === "jobs" && data.kind === "billing_event") {
    if (!/^[\w.:-]{1,200}$/.test(id)) return fail("not_found");
    if (operation === "cancel" && !reason) return fail("reason_required");
    return withAdminAudit(
      ctx,
      { action: `job.${operation}`, targetType: "job", targetId: id, reason },
      async (): Promise<Result<unknown, string>> =>
        operation === "retry"
          ? retryJob(ctx, "billing_event", id)
          : operation === "requeue"
            ? requeueStuckJob(ctx, "billing_event", id)
            : cancelJob(ctx, "billing_event", id, ctx.admin.id),
    );
  }
  if (!ObjectId.isValid(id)) return fail("not_found");
  const oid = new ObjectId(id);
  const now = ctx.now();
  const type =
    area === "users"
      ? "user"
      : area === "workspaces"
        ? "workspace"
        : area === "links"
          ? "link"
          : area === "reports"
            ? "report"
            : area === "domains"
              ? "domain"
              : area === "webhooks"
                ? "webhook"
                : area === "contacts"
                  ? "contact"
                  : area === "feedback"
                    ? "feedback"
                    : area === "billing"
                      ? "subscription"
                      : "job";
  return withAdminAudit(
    ctx,
    {
      action: `${type}.${operation}`,
      targetType: type,
      targetId: id,
      reason,
      ...(type === "workspace" ? { workspaceId: oid } : {}),
    },
    async () => {
      if (area === "billing")
        return billing
          ? mutateAdminBilling(
              ctx,
              oid,
              operation,
              data,
              reason,
              billing.polar,
              billing.server,
            )
          : fail("billing_unavailable");
      if (area === "users") {
        const user = await collection(ctx.db, "user").findOne({ _id: oid });
        if (!user) return fail("not_found");
        if (user.deletedAt) return fail("deleted_account");
        if (user.deletion && ["role", "impersonate"].includes(operation))
          return fail("target_unavailable");
        if (
          ["ban", "unban", "role", "delete"].includes(operation) &&
          id === ctx.admin.id
        )
          return fail("self_action");
        if (["ban", "unban"].includes(operation)) {
          if (user.role === "admin" || user.role === "superadmin") {
            const d = adminDenial(
              { role: ctx.admin.role, elevatedAt: ctx.session.elevatedAt },
              "user.ban.staff",
              { reason, now },
            );
            if (d) return fail(d);
          }
          if (user.role === "superadmin") return fail("superadmin_protected");
          if (operation === "unban") return unbanUser(ctx, id);
          const expiry = text(data, "expiresAt");
          const expires = expiry ? new Date(expiry) : undefined;
          if (
            expires &&
            (!Number.isFinite(expires.getTime()) || expires <= now)
          )
            return fail("invalid_expiry");
          const result = await banUser(ctx, id, {
            by: ctx.admin.id,
            reason,
            ...(expires ? { expires } : {}),
          });
          if (result.ok && typeof user.email === "string")
            await enqueuePlatformNotification(ctx.db, {
              key: `ban:${id}:${now.getTime()}`,
              kind: "accountSuspended",
              to: user.email,
              payload: {
                reason,
                ...(expires ? { until: expires.toISOString() } : {}),
              },
              now,
            });
          return result;
        }
        if (operation === "delete")
          return scheduleUserDeletion(ctx, oid, text(data, "confirm"));
        if (operation === "cancel-deletion")
          return cancelUserDeletion(ctx, oid);
        if (operation === "revoke-sessions") return revokeUserSessions(ctx, id);
        if (operation === "role") {
          const role = z
            .enum(["user", "admin", "superadmin"])
            .safeParse(data.role);
          if (!role.success) return fail("invalid_role");
          if (
            role.data === "superadmin" &&
            (!user.emailVerified || !user.twoFactorEnabled)
          )
            return fail("mfa_enrollment_required");
          const result = await withMutation(ctx.db, async (session) => {
            // Serialize role changes through one invariant row so concurrent demotions cannot remove every superadmin.
            await ctx.db
              .collection<{ _id: string; revision: number }>(
                physicalNames.admin_invariants,
              )
              .updateOne(
                { _id: "roles" },
                { $inc: { revision: 1 } },
                { upsert: true, session },
              );
            const current = await collection(ctx.db, "user").findOne(
              { _id: oid },
              { session },
            );
            if (!current) return fail("not_found");
            if (
              current.role === "superadmin" &&
              role.data !== "superadmin" &&
              (await collection(ctx.db, "user").countDocuments(
                {
                  role: "superadmin",
                  banned: { $ne: true },
                  deletedAt: { $exists: false },
                },
                { session },
              )) <= 1
            )
              return fail("last_superadmin");
            await collection(ctx.db, "user").updateOne(
              { _id: oid },
              { $set: { role: role.data } },
              { session },
            );
            await collection(ctx.db, "admin_sessions").deleteMany(
              { userId: id },
              { session },
            );
            return ok({ before: current.role ?? "user", after: role.data });
          });
          return result;
        }
        if (operation === "impersonate") {
          if (
            user.role === "admin" ||
            user.role === "superadmin" ||
            accountSuspension(user, now)
          )
            return fail("target_unavailable");
          const mode = data.mode === "write" ? "write" : "read";
          if (mode === "write") {
            const d = adminDenial(
              { role: ctx.admin.role, elevatedAt: ctx.session.elevatedAt },
              "user.impersonate.write",
              { reason, now },
            );
            if (d) return fail(d);
          }
          let next = "/";
          if (data.workspace) {
            const workspace = await collection(ctx.db, "workspaces").findOne({
              slug: data.workspace,
            });
            if (
              !workspace ||
              !(await collection(ctx.db, "workspace_members").findOne({
                workspaceId: workspace._id,
                userId: id,
              }))
            )
              return fail("workspace_not_available");
            next = `/${workspace.slug}`;
          }
          const token = randomBytes(32).toString("base64url");
          await ctx.db
            .collection<{
              _id: string;
              userId: string;
              impersonatedBy: string;
              impersonationMode: string;
              expiresAt: Date;
            }>(physicalNames.handoff_tokens)
            .insertOne({
              _id: createHash("sha256").update(token).digest("hex"),
              userId: id,
              impersonatedBy: ctx.admin.id,
              impersonationMode: mode,
              expiresAt: new Date(now.getTime() + 60000),
            });
          return ok({ handoffToken: token, next });
        }
      }
      if (area === "workspaces") {
        const workspace = await collection(ctx.db, "workspaces").findOne({
          _id: oid,
        });
        if (!workspace) return fail("not_found");
        if (["lock", "suspend", "unsuspend"].includes(operation)) {
          const parsed =
            operation === "unsuspend"
              ? null
              : workspaceSuspensionSchema.safeParse({
                  level: operation === "lock" ? "locked" : "suspended",
                  category: data.category,
                  internalNote: reason,
                  publicNote: text(data, "publicNote"),
                  by: ctx.admin.id,
                  at: now,
                });
          if (parsed && !parsed.success) return fail("invalid_category");
          const result = await setWorkspaceSuspension(
            ctx,
            oid,
            parsed?.data ?? null,
          );
          const owner = ObjectId.isValid(workspace.ownerUserId)
            ? await collection(ctx.db, "user").findOne({
                _id: new ObjectId(workspace.ownerUserId),
              })
            : null;
          if (result.ok && owner?.email) {
            const common = {
              workspaceName: workspace.name,
              workspaceSlug: workspace.slug,
            };
            if (operation === "unsuspend")
              await enqueuePlatformNotification(ctx.db, {
                key: `restore:${id}:${now.getTime()}`,
                kind: "workspaceRestored",
                to: owner.email,
                payload: common,
                now,
              });
            else
              await enqueuePlatformNotification(ctx.db, {
                key: `suspend:${id}:${now.getTime()}`,
                kind: "workspaceSuspended",
                to: owner.email,
                payload: {
                  ...common,
                  level: operation === "lock" ? "locked" : "suspended",
                  category: data.category ?? "other",
                  publicNote: text(data, "publicNote"),
                },
                now,
              });
          }
          return result;
        }
        if (operation === "override") {
          if (data.clear === "yes") {
            const subscriptions = await collection(ctx.db, "subscriptions")
              .find({ workspaceId: oid })
              .toArray();
            const plan = resolveEntitlements(subscriptions, now).plan;
            await collection(ctx.db, "workspaces").updateOne(
              { _id: oid },
              {
                $set: { plan },
                $unset: { entitlementOverride: "", compNoticeAt: "" },
              },
            );
            return ok({ before: workspace.entitlementOverride, after: null });
          }
          let limits: unknown;
          try {
            limits = data.limits ? JSON.parse(data.limits) : undefined;
          } catch {
            return fail("invalid_limits");
          }
          let planFeatures: unknown;
          try {
            planFeatures = data.planFeatures
              ? JSON.parse(data.planFeatures)
              : undefined;
          } catch {
            return fail("invalid_override");
          }
          const featureChanges = z
            .object({
              add: z.array(z.enum(catalogFeatures)).max(catalogFeatures.length),
              remove: z
                .array(z.enum(catalogFeatures))
                .max(catalogFeatures.length),
            })
            .safeParse(planFeatures ?? { add: [], remove: [] });
          if (!featureChanges.success) return fail("invalid_override");
          const parsed = entitlementOverrideSchema.safeParse({
            features: featureChanges.data,
            ...(data.plan ? { plan: data.plan } : {}),
            ...(limits ? { limits } : {}),
            ...(data.expiresAt ? { expiresAt: new Date(data.expiresAt) } : {}),
            reason,
            grantedBy: ctx.admin.id,
            grantedAt: now,
          });
          if (!parsed.success) return fail("invalid_override");
          if (parsed.data.expiresAt && parsed.data.expiresAt <= now)
            return fail("invalid_expiry");
          if (
            parsed.data.plan === "enterprise" ||
            !parsed.data.expiresAt ||
            parsed.data.expiresAt.getTime() - now.getTime() > 90 * 86400000
          ) {
            const d = adminDenial(
              { role: ctx.admin.role, elevatedAt: ctx.session.elevatedAt },
              "workspace.override.extended",
              { reason, now },
            );
            if (d) return fail(d);
          }
          const subs = await collection(ctx.db, "subscriptions")
            .find({ workspaceId: oid })
            .toArray();
          const entitlements = resolveEntitlements(subs, now, parsed.data);
          await collection(ctx.db, "workspaces").updateOne(
            { _id: oid },
            {
              $set: {
                entitlementOverride: parsed.data,
                plan: entitlements.plan,
              },
            },
          );
          return ok({
            before: workspace.entitlementOverride,
            after: parsed.data,
          });
        }
        if (operation === "features") {
          const parsed = z
            .object({
              api: z.boolean().optional(),
              mcp: z.boolean().optional(),
              webhooks: z.boolean().optional(),
              bulk: z.boolean().optional(),
              linkRules: z.boolean().optional(),
              advancedAuth: z.boolean().optional(),
            })
            .strict();
          let raw: unknown;
          try {
            raw = JSON.parse(data.flags ?? "{}");
          } catch {
            return fail("invalid_flags");
          }
          const flags = parsed.safeParse(raw);
          if (!flags.success) return fail("invalid_flags");
          await collection(ctx.db, "workspaces").updateOne(
            { _id: oid },
            { $set: { platformFeatures: flags.data } },
          );
          return ok({ before: workspace.platformFeatures, after: flags.data });
        }
      }
      if (area === "links") {
        if (operation === "restore") return restoreLink(ctx, oid);
        const category = z.enum(moderationCategories).safeParse(data.category);
        if (!category.success) return fail("invalid_category");
        const result = await takedownLink(ctx, oid, {
          by: ctx.admin.id,
          category: category.data,
          internalNote: reason,
          publicNote: text(data, "publicNote"),
        });
        if (result.ok && data.suppressNotice !== "yes") {
          const link = await collection(ctx.db, "links").findOne({ _id: oid });
          const workspace = link?.workspaceId
            ? await collection(ctx.db, "workspaces").findOne({
                _id: link.workspaceId,
              })
            : null;
          const owner =
            workspace && ObjectId.isValid(workspace.ownerUserId)
              ? await collection(ctx.db, "user").findOne({
                  _id: new ObjectId(workspace.ownerUserId),
                })
              : null;
          if (owner?.email && workspace)
            await enqueuePlatformNotification(ctx.db, {
              key: `link-removed:${id}:${now.getTime()}`,
              kind: "linkRemoved",
              to: owner.email,
              payload: {
                workspaceName: workspace.name,
                workspaceSlug: workspace.slug,
                links: [
                  {
                    shortUrl: `https://${link?.domain ?? ctx.linkDomain}/${link?.key ?? link?.urlCode}`,
                    category: category.data,
                  },
                ],
                publicNote: text(data, "publicNote"),
              },
              now,
            });
        }
        return result;
      }
      if (area === "reports") {
        const report = await collection(ctx.db, "link_reports").findOne({
          _id: oid,
          status: "open",
        });
        if (!report) return fail("not_open");
        if (operation === "dismiss" && report.linkId) {
          const restored = await clearAutoBlock(ctx, report.linkId);
          if (!restored.ok && restored.error !== "not_auto_blocked")
            return restored;
        }
        await collection(ctx.db, "link_reports").updateOne(
          { _id: oid, status: "open" },
          {
            $set: {
              status: operation === "dismiss" ? "dismissed" : "reviewed",
              resolvedAt: now,
              resolvedBy: ctx.admin.id,
              resolutionNote: reason,
            },
          },
        );
        return ok(null);
      }
      if (area === "domains") {
        if (operation === "reverify") return reverifyDomain(ctx, oid);
        if (operation === "suspend")
          return suspendDomain(ctx, oid, { by: ctx.admin.id, reason });
        if (operation === "unsuspend") return unsuspendDomain(ctx, oid);
        const domain = await collection(ctx.db, "domains").findOne({
          _id: oid,
        });
        if (!domain) return fail("not_found");
        const workspace = await collection(ctx.db, "workspaces").findOne({
          _id: domain.workspaceId,
        });
        if (!workspace) return fail("not_found");
        if (domain.status === "suspended")
          await collection(ctx.db, "domains").updateOne(
            { _id: oid },
            { $set: { status: "pending" }, $unset: { suspension: "" } },
          );
        return removeDomain(
          {
            ...ctx,
            workspace,
            actor: { userId: workspace.ownerUserId, role: "owner" },
          },
          id,
        );
      }
      if (area === "webhooks") {
        if (operation === "disable")
          return adminDisableWebhook(ctx, oid, { by: ctx.admin.id, reason });
        if (operation === "enable") return adminEnableWebhook(ctx, oid);
        return cancelWebhookDeliveries(ctx, oid);
      }
      if (area === "jobs") {
        const kind = z.enum(adminJobKinds).safeParse(data.kind);
        if (!kind.success) return fail("invalid_kind");
        if (operation === "cancel" && !reason) return fail("reason_required");
        return operation === "retry"
          ? retryJob(ctx, kind.data, id)
          : operation === "requeue"
            ? requeueStuckJob(ctx, kind.data, id)
            : cancelJob(ctx, kind.data, id, ctx.admin.id);
      }
      if (area === "contacts") {
        const status = z
          .enum(["new", "open", "replied", "closed", "spam"])
          .safeParse(data.status);
        if (!status.success) return fail("invalid_status");
        await ctx.db.collection(physicalNames.contacts).updateOne(
          { _id: oid },
          {
            $set: {
              triage: {
                status: status.data,
                assignee: text(data, "assignee"),
                note: text(data, "note").slice(0, 2000),
                updatedBy: ctx.admin.id,
                updatedAt: now,
              },
            },
          },
        );
        return ok(null);
      }
      if (area === "feedback") {
        const status = z.enum(feedbackStatuses).safeParse(data.status);
        if (!status.success) return fail("invalid_status");
        const note = text(data, "note").slice(0, 2000);
        const updated = await collection(ctx.db, "feedback").updateOne(
          { _id: oid },
          {
            $set: {
              triage: {
                status: status.data,
                ...(note ? { note } : {}),
                updatedBy: ctx.admin.id,
                updatedAt: now,
              },
            },
          },
        );
        return updated.matchedCount ? ok(null) : fail("not_found");
      }
      return fail("invalid_action");
    },
    (result) =>
      result.ok
        ? result.value &&
          typeof result.value === "object" &&
          "handoffToken" in result.value
          ? { mode: data.mode ?? "read", workspace: data.workspace ?? null }
          : { outcome: result.value }
        : undefined,
  );
}
