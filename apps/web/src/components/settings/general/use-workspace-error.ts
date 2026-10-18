import { useTranslations } from "next-intl";
import { useCallback } from "react";

/** Messages for the workspace create, rename and delete forms. */
export function useWorkspaceError() {
  const t = useTranslations("settings");
  return useCallback(
    (code: string) => {
      switch (code) {
        case "name_required":
          return t("general.validation.nameRequired");
        case "invalid_slug":
          return t("general.errors.slugInvalid");
        case "slug_taken":
          return t("general.errors.slugTaken");
        case "confirm_mismatch":
          return t("delete.errors.mismatch");
        case "not_empty":
          return t("delete.errors.notEmpty");
        case "forbidden":
          return t("common.errors.forbidden");
        default:
          return t("common.errors.generic");
      }
    },
    [t],
  );
}
