import "server-only";
import type { PlanId } from "@shortn/billing";
import { getFormatter, getTranslations } from "next-intl/server";

// Server-side twin of useBillingFormat: billing periods are UTC boundaries.
const dateOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
} as const;

export async function billingFormat() {
  const [t, format] = await Promise.all([
    getTranslations("billing"),
    getFormatter(),
  ]);
  return {
    date: (iso: string) => format.dateTime(new Date(iso), dateOptions),
    /** The period end is exclusive; show the last day it covers. */
    lastDay: (iso: string) =>
      format.dateTime(new Date(new Date(iso).getTime() - 1), dateOptions),
    price: (usd: number | null, eurPerUsd?: number | null) => {
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
    plan: (id: PlanId | null) => t(`plans.${id ?? "free"}`),
  };
}
