import { collection } from "@shortn/db";
import { ObjectId, type Db } from "mongodb";

/** The staff audit row for one action taken in a write-mode impersonation
 * session (23 §3.6). Callers let a failed insert fail the action. */
export async function recordImpersonatedAction(
  db: Db,
  input: {
    adminId: string;
    userId: string;
    workspaceId: ObjectId;
    sessionId: string;
    actionId: string;
    path: string | null;
    now?: Date;
  },
) {
  const admin = /^[a-f\d]{24}$/i.test(input.adminId)
    ? await collection(db, "user").findOne(
        { _id: new ObjectId(input.adminId) },
        { projection: { email: 1, role: 1 } },
      )
    : null;
  const role = admin?.role;
  await collection(db, "admin_audit_log").insertOne({
    _id: new ObjectId(),
    createdAt: input.now ?? new Date(),
    actorId: input.adminId,
    actorEmail: admin?.email ?? "unknown",
    ...(role === "admin" || role === "superadmin" ? { actorRole: role } : {}),
    action: "impersonation.action",
    targetType: "user",
    targetId: input.userId,
    workspaceId: input.workspaceId,
    status: "succeeded",
    adminSessionId: input.sessionId,
    metadata: { actionId: input.actionId, path: input.path },
  });
}
