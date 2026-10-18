import { expect, test } from "bun:test";
import {
  workspaceExportReturnPath,
  workspaceExportPhaseKey,
  workspaceExportErrorKey,
} from "./workspace-export";

test("email handoff accepts only exact workspace export page paths", () => {
  for (const path of [
    "/demo/settings/workspace/export",
    "/demo/settings/workspace/exports",
    "/demo/settings/workspace/exports/000000000000000000000001",
  ])
    expect(workspaceExportReturnPath(path)).toBe(path);
  for (const path of [
    "https://foreign.invalid",
    "//foreign.invalid",
    "/demo/links",
    "/demo/settings/workspace/exports/bad",
    "/demo/settings/workspace/exports/000000000000000000000001?next=https://foreign.invalid",
    "/demo/settings/workspace/export/../links",
    "/demo\\@foreign.invalid/settings/workspace/export",
    null,
    undefined,
  ])
    expect(workspaceExportReturnPath(path)).toBeNull();
});
test("phase and operation errors have bounded localized keys", () => {
  expect(workspaceExportPhaseKey("links")).toBe("phases.links");
  expect(workspaceExportPhaseKey("unexpected")).toBe("phases.workspace");
  expect(workspaceExportErrorKey("export_in_progress")).toBe(
    "errors.export_in_progress",
  );
  expect(workspaceExportErrorKey("private exception")).toBe("errors.failed");
});
