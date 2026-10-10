"use client";

import type { Feature, PlanId, PlanLimits } from "@shortn/billing";
import { Button, cn } from "@shortn/ui";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import {
  changePlanAction,
  checkoutAction,
  type BillingOverview,
} from "@/server/actions/billing";
import { Notice, SettingsSection } from "../section";
import { useBillingFormat } from "./format";
import { useBillingError } from "./use-billing-error";
import { useSettledRefresh } from "./use-settled-refresh";

type PaidPlan = "basic" | "plus" | "pro";
const isPaidPlan = (plan: PlanId): plan is PaidPlan =>
  plan === "basic" || plan === "plus" || plan === "pro";

const rank: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
  enterprise: 4,
};

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

export function PlanTable({
  overview,
  slug,
}: {
  overview: BillingOverview;
  slug: string;
}) {
  const t = useTranslations("billing");
  const f = useBillingFormat();
  const errorFor = useBillingError();
  const refreshSettled = useSettledRefresh();
  const { plan: current, canManage, writesEnabled, subscription } = overview;
  const columns = overview.catalog.filter(
    (column) => column.plan !== "enterprise",
  );
  const featureRows = featureOrder.filter((feature) =>
    columns.some((column) => column.features.includes(feature)),
  );

  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const [confirming, setConfirming] = useState<PaidPlan | null>(null);
  const [changed, setChanged] = useState<{
    plan: PaidPlan;
    when: "now" | "next_period";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const periodEnd = subscription?.currentPeriodEnd ?? overview.period.end;
  const canCheckout = canManage && current === "free";
  const canSwitch =
    canManage && writesEnabled && isPaidPlan(current) && subscription !== null;

  const checkout = async (plan: PaidPlan) => {
    setBusy(plan);
    setError(null);
    try {
      const result = await checkoutAction(slug, plan);
      if (result.ok) {
        window.location.assign(result.data.url);
        return;
      }
      setError(errorFor(result.error));
    } catch {
      setError(t("errors.network"));
    }
    setBusy(null);
  };

  const switchPlan = async (plan: PaidPlan) => {
    setBusy(plan);
    setError(null);
    try {
      const result = await changePlanAction(slug, plan);
      if (result.ok) {
        setConfirming(null);
        setChanged({ plan, when: result.data.when });
        refreshSettled();
      } else setError(errorFor(result.error));
    } catch {
      setError(t("errors.network"));
    }
    setBusy(null);
  };

  const action = (column: Column): ReactNode => {
    const plan = column.plan;
    if (plan === current || !isPaidPlan(plan)) return null;
    if (canCheckout)
      return (
        <Button
          size="sm"
          variant="primary"
          className="w-full"
          loading={busy === plan}
          disabled={busy !== null && busy !== plan}
          onClick={() => void checkout(plan)}
        >
          {t("compare.upgrade")}
        </Button>
      );
    if (canSwitch)
      return (
        <Button
          size="sm"
          className="w-full"
          aria-pressed={confirming === plan}
          disabled={busy !== null}
          onClick={() => {
            setChanged(null);
            setConfirming(plan);
          }}
        >
          {rank[plan] > rank[current]
            ? t("compare.upgrade")
            : t("compare.downgrade")}
        </Button>
      );
    return null;
  };

  const showActions = canCheckout || canSwitch;

  return (
    <SettingsSection
      id="plans"
      wide
      title={t("compare.title")}
      description={t("compare.description")}
    >
      <div className="-mx-gutter overflow-x-auto px-gutter md:mx-0 md:px-0">
        <table className="w-full min-w-xl border-collapse text-small">
          <caption className="sr-only">{t("compare.caption")}</caption>
          <thead>
            <tr className="border-b border-line">
              <td className="w-[32%] py-2 pr-3" />
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
                    {f.price(column.priceUsdMonthly)}
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
                      "px-3 pt-3 pb-3",
                      column.plan === current && "bg-bg-subtle",
                    )}
                  >
                    {action(column)}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {confirming ? (
        <Notice
          tone="neutral"
          live="status"
          action={
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                loading={busy === confirming}
                onClick={() => void switchPlan(confirming)}
              >
                {t("compare.confirmAction", { plan: f.plan(confirming) })}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => setConfirming(null)}
              >
                {t("compare.keep", { plan: f.plan(current) })}
              </Button>
            </span>
          }
        >
          {rank[confirming] > rank[current]
            ? t("compare.confirmUpgrade", { plan: f.plan(confirming) })
            : t("compare.confirmDowngrade", {
                plan: f.plan(confirming),
                current: f.plan(current),
                date: f.date(periodEnd),
              })}
        </Notice>
      ) : null}

      {changed ? (
        <Notice tone="success" live="status">
          {changed.when === "now"
            ? t("compare.changedNow", { plan: f.plan(changed.plan) })
            : t("compare.changedLater", {
                plan: f.plan(changed.plan),
                date: f.date(periodEnd),
              })}
        </Notice>
      ) : null}

      {current === "enterprise" ? (
        <Notice tone="neutral">{t("compare.enterprise")}</Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" live="alert">
          {error}
        </Notice>
      ) : null}
    </SettingsSection>
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
