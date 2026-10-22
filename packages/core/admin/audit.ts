import { collection, type Documents } from "@shortn/db";
import { ObjectId } from "mongodb";
import type { AdminContext } from "./context";

type AuditRow = Documents["admin_audit_log"];

export interface AuditIntent {
  action: string;
  targetType: AuditRow["targetType"];
  targetId: string;
  workspaceId?: ObjectId | undefined;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

const actorFields = (ctx: AdminContext) => ({
  actorId: ctx.admin.id,
  actorEmail: ctx.admin.email,
  actorRole: ctx.admin.role,
  adminSessionId: ctx.session.id,
  ...(ctx.request.ip ? { ip: ctx.request.ip } : {}),
  ...(ctx.request.userAgent ? { userAgent: ctx.request.userAgent } : {}),
  ...(ctx.request.requestId ? { requestId: ctx.request.requestId } : {}),
});

const intentFields = (intent: AuditIntent) => ({
  action: intent.action,
  targetType: intent.targetType,
  targetId: intent.targetId,
  ...(intent.workspaceId ? { workspaceId: intent.workspaceId } : {}),
  ...(intent.reason?.trim() ? { reason: intent.reason.trim() } : {}),
  ...(intent.metadata ? { metadata: intent.metadata } : {}),
});

/** Write-ahead staff audit (23 §1.7): the `started` row is inserted before
 * the mutation runs, so a failed insert refuses the mutation. A result with
 * `ok: false` or a thrown error marks the row failed. `outcome` may add
 * metadata (counts, before/after) to the completed row. */
export async function withAdminAudit<
  R extends { ok: true; value: unknown } | { ok: false; error: string },
>(
  ctx: AdminContext,
  intent: AuditIntent,
  mutate: () => Promise<R>,
  outcome?: (result: R) => Record<string, unknown> | undefined,
): Promise<R> {
  const rows = collection(ctx.db, "admin_audit_log");
  const _id = new ObjectId();
  await rows.insertOne({
    _id,
    createdAt: ctx.now(),
    ...actorFields(ctx),
    ...intentFields(intent),
    status: "started",
  });
  const finish = async (
    status: "succeeded" | "failed",
    error?: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await rows.updateOne(
        { _id },
        {
          $set: {
            status,
            completedAt: ctx.now(),
            ...(error ? { error } : {}),
            ...(extra
              ? { metadata: { ...(intent.metadata ?? {}), ...extra } }
              : {}),
          },
        },
      );
    } catch {
      // The started row already records the intent.
    }
  };
  try {
    const result = await mutate();
    await finish(
      result.ok ? "succeeded" : "failed",
      result.ok ? undefined : result.error,
      outcome?.(result),
    );
    return result;
  } catch (error) {
    await finish("failed", error instanceof Error ? error.message : "error");
    throw error;
  }
}

/** A completed read-only event: session create/revoke, impersonation start,
 * PII export. Throws when the row can't be written. */
export async function recordAdminEvent(ctx: AdminContext, intent: AuditIntent) {
  await collection(ctx.db, "admin_audit_log").insertOne({
    _id: new ObjectId(),
    createdAt: ctx.now(),
    ...actorFields(ctx),
    ...intentFields(intent),
    status: "succeeded",
    completedAt: ctx.now(),
  });
}
