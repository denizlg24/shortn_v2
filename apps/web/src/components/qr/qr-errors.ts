import { useTranslations } from "next-intl";
import { useCallback } from "react";

/** Localized message for an error code from the QR form actions. */
export function useQrErrorMessage() {
  const t = useTranslations("qr.errors");
  return useCallback(
    (code: string, detail?: Record<string, string | number | null>) => {
      switch (code) {
        case "url_required":
          return t("urlRequired");
        case "invalid_url":
          return t("invalidUrl");
        case "unsafe_destination":
          return t("unsafeDestination");
        case "feature_required":
          return t("logoGated");
        case "logo_url":
          return t("logoUrl");
        case "color":
          return t("color");
        case "limit_reached":
          return t("limitReached", { limit: Number(detail?.limit ?? 0) });
        case "forbidden":
          return t("forbidden");
        case "not_found":
          return t("notFound");
        case "invalid_input":
          return t("invalidInput");
        default:
          return t("generic");
      }
    },
    [t],
  );
}
