import { useTranslations } from "next-intl";
import { useCallback } from "react";

/** Localized message for an error code from the campaign form actions. */
export function useCampaignErrorMessage() {
  const t = useTranslations("campaigns.errors");
  return useCallback(
    (code: string, detail?: Record<string, string | number | null>) => {
      switch (code) {
        case "title_required":
        case "invalid_title":
          return t("titleRequired");
        case "title_taken":
          return t("titleTaken");
        case "link_required":
          return t("linkRequired");
        case "duplicate":
          return t("duplicate");
        case "full":
          return t("full", { max: Number(detail?.max ?? 50) });
        case "feature_required":
          return t("gated");
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
