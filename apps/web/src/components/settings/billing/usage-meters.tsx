"use client";

import { UsageMeter } from "@shortn/ui";
import { useTranslations } from "next-intl";
import type { BillingOverview } from "@/server/actions/billing";
import { useBillingFormat } from "./format";

/** Exact numbers against the plan's limits (12: never a bare percentage). */
export function UsageMeters({ overview }: { overview: BillingOverview }) {
  const t = useTranslations("billing");
  const f = useBillingFormat();
  const { usage, limits } = overview;
  const meters = [
    {
      key: "links",
      label: t("usage.links"),
      unit: t("usage.linksUnit"),
      used: usage.links,
      limit: limits.links,
      detail: t("usage.perPeriod"),
    },
    {
      key: "qrCodes",
      label: t("usage.qrCodes"),
      unit: t("usage.qrUnit"),
      used: usage.qrCodes,
      limit: limits.qrCodes,
      detail: t("usage.perPeriod"),
    },
    {
      key: "bioPages",
      label: t("usage.bioPages"),
      unit: t("usage.bioUnit"),
      used: usage.bioPages,
      limit: limits.bioPages,
      detail: t("usage.total"),
    },
  ];
  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
      {meters.map((meter) =>
        meter.limit === null ? (
          <div key={meter.key} className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-meta text-fg-muted">
              {meter.label}
            </span>
            <span aria-hidden className="h-1 rounded-full bg-fg/8" />
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta">
              <span className="font-mono whitespace-nowrap text-fg tabular-nums">
                {f.number(meter.used)}
                <span className="text-fg-subtle">
                  {" "}
                  · {t("usage.unlimited")}
                </span>
              </span>
              <span className="text-fg-subtle">{meter.detail}</span>
            </span>
          </div>
        ) : (
          <UsageMeter
            key={meter.key}
            label={meter.label}
            used={meter.used}
            limit={meter.limit}
            unit={meter.unit}
            detail={meter.detail}
          />
        ),
      )}
    </div>
  );
}
