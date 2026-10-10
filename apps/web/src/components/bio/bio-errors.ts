import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { ActionError, ActionFailure } from "../editor/action-error";

export type BioField = "slug" | "form";

/** Localized message for a failed bio action, on the field it concerns. */
export function useBioError() {
  const t = useTranslations("bio.errors");
  return useCallback(
    (failure: ActionFailure): ActionError<BioField> => {
      switch (failure.error) {
        case "slug_taken":
          return { field: "slug", message: t("slugTaken") };
        case "invalid_slug":
          return { field: "slug", message: t("invalidSlug") };
        case "limit_reached":
          return {
            field: "form",
            message: t("limitReached", {
              limit: Number(failure.detail?.limit ?? 0),
            }),
            upgrade: true,
          };
        case "link_not_found":
          return { field: "form", message: t("linkNotFound") };
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
