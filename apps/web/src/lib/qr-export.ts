export interface ExportStatus {
  id: string;
  state: "pending" | "running" | "completed" | "failed";
  phase?: "rendering" | "assembling";
  format: "svg" | "png" | "pdf";
  size: number;
  total: number;
  done: number;
  expiresAt: string;
  downloadUrl?: string;
  downloadExpiresAt?: string;
  error?: string;
  failedQrId?: string;
  canEdit?: boolean;
  print?: { minimumMm: number; quietModules: number; correction: string };
}
export interface ExportRead {
  job: ExportStatus | null;
  error?: string;
}
const errors = [
  "unavailable",
  "invalid_export",
  "not_found",
  "forbidden",
  "failed",
  "low_contrast",
  "invalid_color",
  "invalid_design",
  "invalid_data",
  "invalid_size",
  "logo_unavailable",
  "storage_unavailable",
  "archive_too_large",
  "access_removed",
  "snapshot_missing",
  "expired",
] as const;
export const exportErrorKey = (error: string | undefined) =>
  errors.find((known) => known === error) ?? "failed";
