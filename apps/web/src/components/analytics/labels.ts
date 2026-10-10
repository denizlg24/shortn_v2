import type { Dimension } from "@shortn/core";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { useIntlLocale } from "@/lib/intl-locale";

const devices = [
  "desktop",
  "mobile",
  "tablet",
  "console",
  "smarttv",
  "wearable",
  "xr",
  "embedded",
] as const;

const noLabels: Record<string, string> = {};

/** Display text for a breakdown value: country names, "Direct", device names, link keys. */
export function useValueLabel(linkLabels: Record<string, string> = noLabels) {
  const t = useTranslations("analytics.values");
  const intlLocale = useIntlLocale();
  const regions = useMemo(
    () => new Intl.DisplayNames([intlLocale], { type: "region" }),
    [intlLocale],
  );
  return useCallback(
    (dimension: Dimension, value: string): string => {
      if (value === "unknown") return t("unknown");
      switch (dimension) {
        case "country":
          try {
            return regions.of(value.toUpperCase()) ?? value;
          } catch {
            return value;
          }
        case "referrer":
          return value === "direct" ? t("direct") : value;
        case "device": {
          const device = devices.find((option) => option === value);
          return device ? t(`devices.${device}`) : value;
        }
        case "kind":
          return value === "scan" ? t("scan") : t("click");
        case "link":
          return linkLabels[value] ? `/${linkLabels[value]}` : t("deleted");
        default:
          return value;
      }
    },
    [t, regions, linkLabels],
  );
}
