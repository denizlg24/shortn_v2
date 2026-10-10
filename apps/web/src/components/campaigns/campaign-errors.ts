import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { ActionError, ActionFailure } from "../editor/action-error";

export type CampaignField = "title" | "form";

/** Localized message for a failed campaign or UTM action. */
export function useCampaignError() {
  const t = useTranslations("campaigns.errors");
  return useCallback(
    (failure: ActionFailure): ActionError<CampaignField> => {
      switch (failure.error) {
        case "title_taken":
          return { field: "title", message: t("titleTaken") };
        case "invalid_title":
          return { field: "title", message: t("titleRequired") };
        case "feature_required":
          return { field: "form", message: t("gated"), upgrade: true };
        case "forbidden":
          return { field: "form", message: t("forbidden") };
        case "not_found":
          return { field: "form", message: t("notFound") };
        case "invalid_input":
          return { field: "form", message: t("invalidInput") };
        case "network":
          return { field: "form", message: t("network") };
        default:
          return { field: "form", message: t("generic") };
      }
    },
    [t],
  );
}
