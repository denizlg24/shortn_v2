import type { linkExportView } from "@shortn/core";
export type LinkExportJobStatus = ReturnType<typeof linkExportView> & {
  downloadUrl?: string;
};
export type LinkExportRead = {
  job: LinkExportJobStatus | null;
  error?: string;
};
export type LinkExportPrepared = {
  mode: "download";
  format: "csv" | "json";
  total: number;
  expiresAt: string;
  downloadUrl: string;
};
const errors = [
  "failed",
  "forbidden",
  "feature_required",
  "unavailable",
  "not_found",
  "expired",
  "invalid_export",
  "idempotency_conflict",
  "invalid_state",
  "storage_unavailable",
  "archive_too_large",
  "export_cancelled",
  "unauthorized",
] as const;
type Code = (typeof errors)[number];
export function linkExportErrorKey(code: string): `errors.${Code}` {
  return `errors.${errors.includes(code as Code) ? (code as Code) : "failed"}`;
}
