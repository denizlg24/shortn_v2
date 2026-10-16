import { ObjectId } from "mongodb";
import { collection } from "@shortn/db";
import type { ServiceContext } from "../workspaces/context";

/** Persist intent before dispatch, so an audit outage cannot permit an unaudited mutation. */
export async function withMcpAudit<T>(
  ctx: ServiceContext,
  identity: { client: string; credentialId: string },
  tool: string,
  action: () => Promise<T>,
  log: (message: string) => void,
): Promise<T> {
  const records = collection(ctx.db, "audit_log"),
    _id = new ObjectId();
  await records.insertOne({
    _id,
    workspaceId: ctx.workspace._id,
    actor: `mcp:${identity.client}`,
    userId: ctx.actor.userId,
    credentialId: identity.credentialId,
    tool,
    status: "started",
    createdAt: new Date(),
  });
  const finish = async (status: "succeeded" | "failed") => {
    try {
      await records.updateOne(
        { _id },
        { $set: { status, completedAt: new Date() } },
      );
    } catch {
      log("MCP audit completion unavailable; durable intent retained");
    }
  };
  try {
    const result = await action();
    await finish("succeeded");
    return result;
  } catch (error) {
    await finish("failed");
    throw error;
  }
}
