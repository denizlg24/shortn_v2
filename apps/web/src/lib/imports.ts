import type { importJobView } from "@shortn/core";
export type ImportStatus = ReturnType<typeof importJobView> & {
  canEdit: boolean;
  canCancel: boolean;
  errorCsvUrl?: string;
};
export const importFields = [
  "url",
  "key",
  "title",
  "tags",
  "domain",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "expires_at",
] as const;
export const importControl =
  "h-9 w-full min-w-0 rounded-control border border-line-strong bg-bg px-3 text-small text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50";
const errorCodes = [
  "failed",
  "forbidden",
  "invalid_input",
  "empty_file",
  "file_too_large",
  "too_many_rows",
  "too_many_columns",
  "field_too_large",
  "invalid_csv",
  "invalid_encoding",
  "invalid_mapping",
  "invalid_state",
  "empty_import",
  "not_found",
  "unavailable",
  "storage_unavailable",
  "upload_failed",
  "upload_cancelled",
  "key_taken",
  "key_reserved",
  "key_invalid",
  "invalid_url",
  "missing_url",
  "invalid_date",
  "invalid_tags",
  "column_count",
  "limit_exceeded",
  "commit_limit_exceeded",
  "limit_reached",
  "invalid_key",
  "unsafe_destination",
  "feature_required",
  "access_removed",
  "upload_missing_or_changed",
  "source_changed",
  "infrastructure_unavailable",
  "reservation_closed",
  "snapshot_missing",
] as const;
type ImportErrorCode = (typeof errorCodes)[number];
const knownErrors = new Set<string>(errorCodes);
export function importErrorKey(code: string): `errors.${ImportErrorCode}` {
  const value = code.startsWith("commit_") ? code.slice(7) : code;
  return `errors.${knownErrors.has(value) ? (value as ImportErrorCode) : "failed"}`;
}
