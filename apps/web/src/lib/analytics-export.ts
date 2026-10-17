import type { analyticsExportView } from "@shortn/core";
export type AnalyticsExportStatus = ReturnType<typeof analyticsExportView> & {
  downloadUrl?: string;
};
export type AnalyticsExportRead = {
  job: AnalyticsExportStatus | null;
  error?: string;
};
