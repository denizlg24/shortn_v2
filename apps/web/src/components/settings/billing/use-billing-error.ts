import { useTranslations } from "next-intl";
import { useCallback } from "react";

export function useBillingError() {
  const t = useTranslations("billing.errors");
  return useCallback(
    (code: string) => {
      switch (code) {
        case "already_subscribed":
          return t("alreadySubscribed");
        case "billing_writes_disabled":
          return t("writesDisabled");
        case "not_subscribed":
          return t("notSubscribed");
        case "same_plan":
          return t("samePlan");
        case "custom_priced":
          return t("customPriced");
        case "forbidden":
          return t("forbidden");
        default:
          return t("generic");
      }
    },
    [t],
  );
}
