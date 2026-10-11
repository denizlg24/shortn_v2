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
    (usd: number | null, eurPerUsd?: number | null) => {
      if (usd === null) return t("priceCustom");
      const dollars = format.number(usd, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      if (usd === 0)
        return t("price", {
          price: format.number(0, {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }),
        });
      if (eurPerUsd && Number.isFinite(eurPerUsd) && eurPerUsd > 0)
        return t("priceEstimate", {
          eur: format.number(usd * eurPerUsd, {
            style: "currency",
            currency: "EUR",
          }),
          usd: dollars,
        });
      return t("price", { price: dollars });
    },
    [format, t],
  );

  const plan = useCallback(
    (id: PlanId | null) => t(`plans.${id ?? "free"}`),
    [t],
  );

  return { date, lastDay, price, plan, number: format.number };
}
