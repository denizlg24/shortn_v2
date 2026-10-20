import { expect, test } from "bun:test";
import { workspaceBlock } from "./workspace-access";

const suspension = (level: "locked" | "suspended") => ({
  suspension: {
    level,
    category: "other" as const,
    internalNote: "n",
    by: "staff",
    at: new Date(),
  },
});

test("locked workspaces allow reads and exports; suspended ones allow nothing", () => {
  expect(workspaceBlock({}, "POST", "/v1/links")).toBeNull();
  const locked = suspension("locked");
  expect(workspaceBlock(locked, "GET", "/v1/links")).toBeNull();
  expect(workspaceBlock(locked, "head", "/v1/links")).toBeNull();
  expect(workspaceBlock(locked, "POST", "/v1/qr-codes/export")).toBeNull();
  for (const method of ["POST", "PATCH", "DELETE", "PUT"])
    expect(workspaceBlock(locked, method, "/v1/links")).toBe(
      "workspace_locked",
    );
  const suspended = suspension("suspended");
  expect(workspaceBlock(suspended, "GET", "/v1/links")).toBe(
    "workspace_suspended",
  );
  expect(workspaceBlock(suspended, "POST", "/v1/qr-codes/export")).toBe(
    "workspace_suspended",
  );
});
