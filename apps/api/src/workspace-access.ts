import { workspaceAccess } from "@shortn/core";
import type { Documents } from "@shortn/db";

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);
// Exports stay available while locked (data portability, 23 §3.2).
const lockedWritesAllowed = new Set(["/v1/qr-codes/export"]);

/** The REST refusal for a staff-locked or suspended workspace, if any. */
export function workspaceBlock(
  workspace: Pick<Documents["workspaces"], "suspension">,
  method: string,
  path: string,
): "workspace_suspended" | "workspace_locked" | null {
  const access = workspaceAccess(workspace);
  if (access === "suspended") return "workspace_suspended";
  if (
    access === "locked" &&
    !readMethods.has(method.toUpperCase()) &&
    !lockedWritesAllowed.has(path)
  )
    return "workspace_locked";
  return null;
}
