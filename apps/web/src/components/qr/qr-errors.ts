import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { ActionError, ActionFailure } from "../editor/action-error";

export type QrField = "url" | "logo" | "form";

/** Localized message for a failed QR action, on the field it concerns. */
export function useQrError() {
  const t = useTranslations("qr.errors");
  return useCallback(
    (failure: ActionFailure): ActionError<QrField> => {
      switch (failure.error) {
        case "invalid_url":
          return { field: "url", message: t("invalidUrl") };
        case "unsafe_destination":
          return { field: "url", message: t("unsafeDestination") };
        case "feature_required":
          return { field: "logo", message: t("logoGated"), upgrade: true };
        case "limit_reached":
          return {
            field: "form",
            message: t("limitReached", {
              limit: Number(failure.detail?.limit ?? 0),
            }),
            upgrade: true,
          };
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
