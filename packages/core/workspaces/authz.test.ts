import { expect, test } from "bun:test";
import { can, type Action, type Actor } from "./authz";
import { workspaceAccess, workspaceReadOnly } from "./status";

const actions: Action[] = [
  "workspace.view",
  "resource.create",
  "resource.update",
  "resource.delete",
  "domains.manage",
  "apiKeys.manage",
  "apiKeys.revoke",
  "webhooks.manage",
  "members.manage",
  "members.remove",
  "workspace.update",
  "billing.manage",
  "workspace.delete",
];
const allowed = (actor: Actor) =>
  actions.filter((action) => can(actor, action, { createdBy: actor.userId }));
const owner: Actor = { userId: "u", role: "owner" };

test("an owner can do everything", () => {
  expect(allowed(owner)).toEqual(actions);
});

test("locked and suspended workspaces allow viewing, billing and access-reducing actions", () => {
  for (const readOnly of ["locked", "suspended"] as const)
    expect(allowed({ ...owner, readOnly })).toEqual([
      "workspace.view",
      "apiKeys.revoke",
      "members.remove",
      "billing.manage",
    ]);
});

test("read-only impersonation views only; write mode never touches billing, keys or deletion", () => {
  expect(allowed({ ...owner, impersonation: "read" })).toEqual([
    "workspace.view",
  ]);
  const write = allowed({ ...owner, impersonation: "write" });
  expect(write).toContain("resource.create");
  expect(write).toContain("members.manage");
  for (const action of [
    "billing.manage",
    "apiKeys.manage",
    "apiKeys.revoke",
    "workspace.delete",
  ] as const)
    expect(write).not.toContain(action);
  // Impersonating into a locked workspace only views or reduces access.
  expect(
    allowed({ ...owner, impersonation: "write", readOnly: "locked" }),
  ).toEqual(["workspace.view", "members.remove"]);
});

test("workspace access follows the suspension level", () => {
  const at = new Date();
  const suspension = (level: "locked" | "suspended") => ({
    level,
    category: "other" as const,
    internalNote: "n",
    by: "s",
    at,
  });
  expect(workspaceAccess({})).toBe("active");
  expect(workspaceReadOnly({})).toBeUndefined();
  expect(workspaceAccess({ suspension: suspension("locked") })).toBe("locked");
  expect(workspaceReadOnly({ suspension: suspension("suspended") })).toBe(
    "suspended",
  );
});
