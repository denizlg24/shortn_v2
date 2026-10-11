import { useTranslations } from "next-intl";
import { useCallback } from "react";

/** Localized message for an error code from the bio form actions. */
export function useBioErrorMessage() {
  const t = useTranslations("bio");
  return useCallback(
    (code: string, detail?: Record<string, string | number | null>) => {
      const position = Number(detail?.position ?? 0);
      switch (code) {
        case "slug_required":
        case "invalid_slug":
          return t("errors.invalidSlug");
        case "slug_taken":
          return t("errors.slugTaken");
        case "limit_reached":
          return t("errors.limitReached", {
            limit: Number(detail?.limit ?? 0),
          });
        case "link_not_found":
          return t("errors.linkNotFound");
        case "titleRequired":
        case "avatarUrl":
          return t(`profile.errors.${code}`);
        case "image":
          return t("links.errors.image", { position });
        case "url":
          return t("socials.errors.url", { position });
        case "color":
        case "background":
        case "headerImage":
          return t(`appearance.errors.${code}`);
        case "forbidden":
          return t("errors.forbidden");
        case "not_found":
          return t("errors.notFound");
        case "invalid_input":
          return t("errors.invalidInput");
        default:
          return t("errors.generic");
      }
    },
    [t],
  );
}
