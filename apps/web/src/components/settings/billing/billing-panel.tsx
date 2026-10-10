"use client";

import { Button, UsageMeter } from "@shortn/ui";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  portalAction,
  setCancelAction,
  type BillingOverview,
} from "@/server/actions/billing";
import { Notice, SettingsSection, textAction } from "../section";
import { useBillingFormat } from "./format";
import { PlanTable } from "./plan-table";
import { useSettledRefresh } from "./use-settled-refresh";
import { useBillingError } from "./use-billing-error";

export function BillingPanel({
  overview,
  workspace,
  checkoutReturned,
  legacyUrl,
}: {
  overview: BillingOverview;
  workspace: { slug: string; name: string };
  checkoutReturned: boolean;
  /** Legacy billing page; plan changes stay there until the switch (16 D8). */
  legacyUrl: string;
}) {
  return (
    <>
      <PlanSection
        overview={overview}
        workspace={workspace}
        checkoutReturned={checkoutReturned}
        legacyUrl={legacyUrl}
      />
      <UsageSection overview={overview} />
      <PlanTable overview={overview} slug={workspace.slug} />
    </>
  );
}

function PlanSection({
  overview,
  workspace,
  checkoutReturned,
  legacyUrl,
}: {
  overview: BillingOverview;
  workspace: { slug: string; name: string };
  checkoutReturned: boolean;
  legacyUrl: string;
}) {
  const t = useTranslations("billing");
  const f = useBillingFormat();
  const errorFor = useBillingError();
  const refreshSettled = useSettledRefresh();
  const { plan, subscription, writesEnabled, canManage } = overview;
  const [portalPending, setPortalPending] = useState(false);
  const [cancelStep, setCancelStep] = useState<"idle" | "confirm" | "busy">(
    "idle",
  );
  const [result, setResult] = useState<"cancelled" | "resumed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = overview.catalog.find((item) => item.plan === plan);
  const paid = plan !== "free" && subscription !== null;
  const waitingForCheckout = checkoutReturned && plan === "free";

  useEffect(() => {
    if (waitingForCheckout) refreshSettled();
  }, [waitingForCheckout, refreshSettled]);

  const openPortal = async () => {
    setPortalPending(true);
    setError(null);
    try {
      const response = await portalAction(workspace.slug);
      if (response.ok) {
        window.location.assign(response.data.url);
        return;
      }
      setError(errorFor(response.error));
    } catch {
      setError(t("errors.network"));
    }
    setPortalPending(false);
  };

  const setCancel = async (cancel: boolean) => {
    setCancelStep("busy");
    setError(null);
    try {
      const response = await setCancelAction(workspace.slug, cancel);
      if (response.ok) {
        setResult(cancel ? "cancelled" : "resumed");
        refreshSettled();
      } else setError(errorFor(response.error));
    } catch {
      setError(t("errors.network"));
    }
    setCancelStep("idle");
  };

  const portalButton = (
    <Button onClick={() => void openPortal()} loading={portalPending}>
      {t("current.manage")}
      <ArrowUpRight aria-hidden className="text-fg-subtle" />
    </Button>
  );

  const renewal = subscription
    ? subscription.cancelAtPeriodEnd
      ? t("current.ends", { date: f.date(subscription.currentPeriodEnd) })
      : t("current.renews", { date: f.date(subscription.currentPeriodEnd) })
    : t("current.freeResets", { date: f.date(overview.period.end) });

  const scheduled =
    subscription?.scheduledChange && !subscription.cancelAtPeriodEnd
      ? subscription.scheduledChange
      : null;

  return (
    <SettingsSection
      wide
      title={t("current.title")}
      description={canManage ? undefined : t("current.ownerOnly")}
      aside={canManage ? portalButton : null}
    >
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-title font-semibold tracking-[-0.015em]">
            {f.plan(plan)}
          </span>
          {price ? (
            <span className="text-body text-fg-muted">
              {f.price(price.priceUsdMonthly)}
            </span>
          ) : null}
        </p>
        <p className="text-small text-fg-muted">{renewal}</p>
      </div>

      {checkoutReturned ? (
        <Notice
          tone={waitingForCheckout ? "neutral" : "success"}
          live="status"
          action={
            waitingForCheckout ? (
              <button
                type="button"
                className={textAction}
                onClick={refreshSettled}
              >
                {t("status.refresh")}
              </button>
            ) : null
          }
        >
          {waitingForCheckout
            ? t("status.checkoutPending")
            : t("status.checkoutDone", {
                workspace: workspace.name,
                plan: f.plan(plan),
              })}
        </Notice>
      ) : null}

      {subscription?.status === "past_due" ? (
        <Notice
          tone="danger"
          action={
            canManage ? (
              <button
                type="button"
                className={textAction}
                onClick={() => void openPortal()}
                disabled={portalPending}
              >
                {t("status.updatePayment")}
              </button>
            ) : null
          }
        >
          {t("status.pastDue", { plan: f.plan(plan) })}
        </Notice>
      ) : null}

      {subscription?.cancelAtPeriodEnd && result !== "resumed" ? (
        <Notice
          tone="warning"
          action={
            canManage && writesEnabled ? (
              <button
                type="button"
                className={textAction}
                onClick={() => void setCancel(false)}
                disabled={cancelStep === "busy"}
              >
                {t("current.keepPlan", { plan: f.plan(plan) })}
              </button>
            ) : null
          }
        >
          {t("status.cancelling", {
            plan: f.plan(plan),
            date: f.date(subscription.currentPeriodEnd),
          })}
        </Notice>
      ) : null}

      {scheduled ? (
        <Notice tone="neutral">
          {t("status.scheduled", {
            plan: f.plan(scheduled.plan),
            date: f.date(scheduled.at),
          })}
        </Notice>
      ) : null}

      {result ? (
        <Notice tone="success" live="status">
          {result === "cancelled"
            ? t("current.cancelled", {
                plan: f.plan(plan),
                date: f.date(
                  subscription?.currentPeriodEnd ?? overview.period.end,
                ),
              })
            : t("current.resumed", { plan: f.plan(plan) })}
        </Notice>
      ) : null}

      {canManage && paid && plan !== "enterprise" ? (
        writesEnabled ? (
          subscription.cancelAtPeriodEnd ||
          result === "cancelled" ? null : cancelStep === "idle" ? (
            <div>
              <Button
                variant="dangerGhost"
                className="-ml-3"
                onClick={() => setCancelStep("confirm")}
              >
                {t("current.cancel")}
              </Button>
            </div>
          ) : (
            <Notice
              tone="warning"
              live="status"
              action={
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    loading={cancelStep === "busy"}
                    onClick={() => void setCancel(true)}
                  >
                    {t("current.cancelConfirmAction")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cancelStep === "busy"}
                    onClick={() => setCancelStep("idle")}
                  >
                    {t("current.keepPlan", { plan: f.plan(plan) })}
                  </Button>
                </span>
              }
            >
              {t("current.cancelConfirm", {
                plan: f.plan(plan),
                date: f.date(subscription.currentPeriodEnd),
              })}
            </Notice>
          )
        ) : (
          <Notice
            tone="neutral"
            action={
              <a href={legacyUrl} className={textAction}>
                {t("current.legacyAction")}
                <ArrowUpRight
                  aria-hidden
                  className="ml-0.5 inline size-3.5 align-[-2px]"
                />
              </a>
            }
          >
            {t("current.legacy")}
          </Notice>
        )
      ) : null}

      {error ? (
        <Notice tone="danger" live="alert">
          {error}
        </Notice>
      ) : null}
    </SettingsSection>
  );
}

function UsageSection({ overview }: { overview: BillingOverview }) {
  const t = useTranslations("billing");
  const f = useBillingFormat();
  const { usage, limits, period } = overview;
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
  const atLimit = meters.some(
    (meter) => meter.limit !== null && meter.used >= meter.limit,
  );

  return (
    <SettingsSection
      wide
      title={t("usage.title")}
      description={t("usage.period", {
        start: f.date(period.start),
        end: f.lastDay(period.end),
      })}
    >
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
      {atLimit && overview.plan !== "enterprise" ? (
        <Notice
          tone="warning"
          action={
            overview.canManage ? (
              <a href="#plans" className={textAction}>
                {t("usage.seePlans")}
              </a>
            ) : null
          }
        >
          {overview.canManage ? t("usage.atLimit") : t("usage.atLimitAskOwner")}
        </Notice>
      ) : null}
    </SettingsSection>
  );
}
