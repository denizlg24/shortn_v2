import type { ExchangeRate } from "@shortn/billing";
import { getTranslations } from "next-intl/server";
import { billingFormat } from "@/server/billing-format";

export async function ExchangeRateNote({
  rate,
}: {
  rate: ExchangeRate | null;
}) {
  const [t, f] = await Promise.all([
    getTranslations("billing"),
    billingFormat(),
  ]);
  return (
    <p className="mt-3 text-small text-fg-muted">
      {rate
        ? t("exchangeRate.note", { date: f.date(rate.asOf) })
        : t("exchangeRate.unavailable")}
    </p>
  );
}
