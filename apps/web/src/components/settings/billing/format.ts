import type { PlanId } from "@shortn/billing";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback } from "react";

// Billing periods are UTC boundaries; formatting in UTC also keeps the
// server render and hydration identical.
const dateOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
} as const;

export function useBillingFormat() {
  const t = useTranslations("billing");
  const format = useFormatter();

  const date = useCallback(
    (iso: string) => format.dateTime(new Date(iso), dateOptions),
    [format],
  );

  /** The period end is exclusive; show the last day it covers. */
  const lastDay = useCallback(
    (iso: string) =>
      format.dateTime(new Date(new Date(iso).getTime() - 1), dateOptions),
    [format],
  );

  const price = useCallback(
    (usd: number | null) =>
      usd === null
        ? t("priceCustom")
        : t("price", {
            price: format.number(usd, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }),
          }),
    [format, t],
  );

  const plan = useCallback(
    (id: PlanId | null) => t(`plans.${id ?? "free"}`),
    [t],
  );

  return { date, lastDay, price, plan, number: format.number };
}
