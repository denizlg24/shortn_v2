"use client";

import type { Feature, PlanId, PlanLimits } from "@shortn/billing";
import { cn } from "@shortn/ui";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { BillingOverview } from "@/server/actions/billing";
import { useBillingFormat } from "./format";

const limitRows = [
  "links",
  "qrCodes",
  "bioPages",
  "seats",
  "workspaces",
  "analyticsDays",
  "apiPerMinute",
] as const satisfies readonly (keyof PlanLimits)[];

const featureOrder = [
  "customKeys",
  "passwords",
  "campaigns",
  "campaignExport",
  "analyticsBreakdowns",
  "csvExport",
  "qrLogo",
  "api",
  "mcp",
] as const satisfies readonly Feature[];

type Column = BillingOverview["catalog"][number];

/** Plans side by side; the page decides what each column's action is. */
export function PlanCompare({
  overview,
  actions,
  eurPerUsd,
}: {
  overview: BillingOverview;
  eurPerUsd?: number | null;
  actions: Partial<Record<PlanId, ReactNode>>;
}) {
  const t = useTranslations("billing");
  const f = useBillingFormat();
  const current = overview.plan;
  const columns = overview.catalog.filter(
    (column) => column.plan !== "enterprise",
  );
  const featureRows = featureOrder.filter((feature) =>
    columns.some((column) => column.features.includes(feature)),
  );
  const showActions = columns.some((column) => actions[column.plan]);

  return (
    <div className="relative -mx-gutter overflow-x-auto px-gutter md:mx-0 md:px-0">
      <table className="w-full min-w-xl border-collapse text-small">
        <caption className="sr-only">{t("compare.caption")}</caption>
        <thead>
          <tr className="border-b border-line">
            <td className="w-[28%] py-2 pr-3" />
            {columns.map((column) => (
              <th
                key={column.plan}
                scope="col"
                aria-current={column.plan === current ? "true" : undefined}
                className={cn(
                  "px-3 py-2.5 text-left align-bottom font-normal",
                  column.plan === current && "bg-bg-subtle",
                )}
              >
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <span className="font-semibold text-fg">
                    {f.plan(column.plan)}
                  </span>
                  {column.plan === current ? (
                    <span className="rounded-chip bg-bg-muted px-1.5 text-meta text-fg-muted">
                      {t("compare.current")}
                    </span>
                  ) : null}
                </span>
                <span className="block text-fg-muted">
                  {f.price(column.priceUsdMonthly, eurPerUsd)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {limitRows.map((row) => (
            <tr key={row} className="border-b border-line">
              <th
                scope="row"
                className="py-2 pr-3 text-left font-normal text-fg-muted"
              >
                {t(`compare.rows.${row}`)}
              </th>
              {columns.map((column) => (
                <Cell key={column.plan} current={column.plan === current}>
                  <LimitValue column={column} row={row} />
                </Cell>
              ))}
            </tr>
          ))}
          {featureRows.map((feature) => (
            <tr key={feature} className="border-b border-line">
              <th
                scope="row"
                className="py-2 pr-3 text-left font-normal text-fg-muted"
              >
                {t(`compare.features.${feature}`)}
              </th>
              {columns.map((column) => (
                <Cell key={column.plan} current={column.plan === current}>
                  <Included value={column.features.includes(feature)} />
                </Cell>
              ))}
            </tr>
          ))}
        </tbody>
        {showActions ? (
          <tfoot>
            <tr>
              <td className="pt-3 pr-3" />
              {columns.map((column) => (
                <td
                  key={column.plan}
                  className={cn(
                    "px-3 pt-3 pb-3 align-top",
                    column.plan === current && "bg-bg-subtle",
                  )}
                >
                  {actions[column.plan]}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function Cell({
  current,
  children,
}: {
  current: boolean;
  children: ReactNode;
}) {
  return (
    <td className={cn("px-3 py-2", current && "bg-bg-subtle")}>{children}</td>
  );
}

function Included({ value }: { value: boolean }) {
  const t = useTranslations("billing.compare");
  return value ? (
    <>
      <Check aria-hidden className="size-4 text-fg" />
      <span className="sr-only">{t("included")}</span>
    </>
  ) : (
    <>
      <Minus aria-hidden className="size-4 text-fg-subtle" />
      <span className="sr-only">{t("notIncluded")}</span>
    </>
  );
}

function LimitValue({
  column,
  row,
}: {
  column: Column;
  row: (typeof limitRows)[number];
}) {
  const t = useTranslations("billing.compare");
  const f = useBillingFormat();
  const value = column.limits[row];
  if (value === null) {
    // The free plan has no API rate because it has no API access at all.
    if (row === "apiPerMinute" && !column.features.includes("api"))
      return <Included value={false} />;
    return <span>{t("unlimited")}</span>;
  }
  if (row === "analyticsDays")
    return (
      <span>
        {value % 365 === 0
          ? t("years", { years: value / 365 })
          : t("days", { days: value })}
      </span>
    );
  return <span className="font-mono tabular-nums">{f.number(value)}</span>;
}
