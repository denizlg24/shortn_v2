import type { workspaceExportView } from "@shortn/core";
import { linkExportErrorKey } from "./link-export";
export type WorkspaceExportStatus = ReturnType<typeof workspaceExportView> & {
  downloadUrl?: string;
};
export type WorkspaceExportRead = {
  job: WorkspaceExportStatus | null;
  error?: string;
};
export function workspaceExportErrorKey(code: string) {
  return code === "export_in_progress"
    ? ("errors.export_in_progress" as const)
    : linkExportErrorKey(code);
}
const phases = [
  "workspace",
  "links",
  "qr_codes",
  "bio_pages",
  "bio_page_versions",
  "campaigns",
  "tags",
  "domains",
  "analytics",
  "manifest",
  "completed",
] as const;
export function workspaceExportPhaseKey(phase: string) {
  return `phases.${phases.includes(phase as (typeof phases)[number]) ? (phase as (typeof phases)[number]) : "workspace"}` as const;
}
/** Only export page paths are eligible for the protected email-link handoff. */
export function workspaceExportReturnPath(path: string | null | undefined) {
  return path &&
    /^\/[a-z0-9][a-z0-9-]{0,62}\/settings\/workspace\/(?:export|exports(?:\/[a-f\d]{24})?)$/.test(
      path,
    )
    ? path
    : null;
}
