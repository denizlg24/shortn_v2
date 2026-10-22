import { physicalNames } from "@shortn/db";
import mongoose from "mongoose";

// The edge falls back to this app when the redirect service fails, so links
// of a suspended workspace must stay blocked here too until P7 (doc 23 §3.2).
export async function legacyWorkspaceSuspended(workspaceId: unknown) {
  if (!(workspaceId instanceof mongoose.Types.ObjectId)) return false;
  const db = mongoose.connection.db;
  if (!db) throw new Error("Legacy database is disconnected");
  return Boolean(
    await db
      .collection(physicalNames.workspaces)
      .findOne(
        { _id: workspaceId, "suspension.level": "suspended" },
        { projection: { _id: 1 } },
      ),
  );
}
