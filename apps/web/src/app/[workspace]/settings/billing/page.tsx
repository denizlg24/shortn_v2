import { buttonVariants, Skeleton } from "@shortn/ui";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { CheckoutReturn } from "@/components/settings/billing/checkout-return";
import { exchangeRate } from "@/server/exchange-rate";
import { ExchangeRateNote } from "@/components/settings/billing/exchange-rate-note";
import { UsageMeters } from "@/components/settings/billing/usage-meters";
import { PaymentRetry } from "@/components/settings/billing/payment-retry";
import { PaymentHistory } from "@/components/settings/billing/payment-history";
import {
  portalPageAction,
  resumePlanPageAction,
} from "@/server/actions/settings-pages";
import { billingFormat } from "@/server/billing-format";
import { billingOverview } from "@/server/plan";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function BillingSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/billing">) {
  const slug = (await params).workspace;
  const [query, { workspace }, overview, t, tSettings, f, locale, rate] =
    await Promise.all([
      searchParams,
      requireWorkspace(slug),
      billingOverview(slug),
      getTranslations("billing"),
      getTranslations("settings"),
      billingFormat(),
      getLocale(),
      exchangeRate(),
    ]);
  const { plan, subscription, writesEnabled, canManage } = overview;
  const price = overview.catalog.find((item) => item.plan === plan);
  const base = `/${slug}/settings/billing`;
  const legacyUrl = `https://shortn.at/${locale}/dashboard/settings/plan`;
  const periodEnd = subscription?.currentPeriodEnd ?? overview.period.end;
  const checkout = one(query.checkout);
  const changed = one(query.changed);
  const requestedPage = Number(one(query.page));
  const paymentPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(100000, requestedPage)
      : 1;
  const scheduled =
    subscription?.scheduledChange && !subscription.cancelAtPeriodEnd
      ? subscription.scheduledChange
      : null;
  const atLimit = (["links", "qrCodes", "bioPages"] as const).some((key) => {
    const limit = overview.limits[key];
    return limit !== null && overview.usage[key] >= limit;
  });
  const textLink = "font-medium text-signal hover:underline";

  return (
    <Page
      crumbs={[
        { label: tSettings("title"), href: `/${slug}/settings` },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("description", { workspace: workspace.name })}
      actions={
        <Link
          href={`${base}/plans`}
          className={buttonVariants({ variant: "secondary", size: "lg" })}
        >
          {t("current.comparePlans")}
        </Link>
      }
    >
      {checkout ? (
        <CheckoutReturn
          waiting={plan === "free"}
          message={
            plan === "free"
              ? t("status.checkoutPending")
              : t("status.checkoutDone", {
                  workspace: workspace.name,
                  plan: f.plan(plan),
                })
          }
        />
      ) : null}
      {changed === "basic" || changed === "plus" || changed === "pro" ? (
        <Notice tone="success">
          {one(query.when) === "next_period"
            ? t("compare.changedLater", {
                plan: f.plan(changed),
                date: f.date(periodEnd),
              })
            : t("compare.changedNow", { plan: f.plan(changed) })}
        </Notice>
      ) : null}
      {query.cancelled ? (
        <Notice tone="success">
          {t("current.cancelled", {
            plan: f.plan(plan),
            date: f.date(periodEnd),
          })}
        </Notice>
      ) : null}
      {query.resumed ? (
        <Notice tone="success">
          {t("current.resumed", { plan: f.plan(plan) })}
        </Notice>
      ) : null}
      {one(query.pending) === "invoice" ? (
        <Notice>
          {t("invoices.generating")} <PaymentRetry />
        </Notice>
      ) : null}
      {query.failed ? (
        <Notice tone="warning">
          {one(query.failed) === "portal"
            ? t("errors.portal")
            : one(query.failed) === "invoice"
              ? t("invoices.downloadFailed")
              : t("errors.generic")}
        </Notice>
      ) : null}

      <Section
        title={t("current.title")}
        description={canManage ? undefined : t("current.ownerOnly")}
      >
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-title font-semibold tracking-[-0.015em]">
            {f.plan(plan)}
          </span>
          {price ? (
            <span className="text-body text-fg-muted">
              {f.price(price.priceUsdMonthly, rate?.eurPerUsd)}
            </span>
          ) : null}
        </p>
        <ExchangeRateNote rate={rate} />
        <p className="mt-1 text-small text-fg-muted">
          {subscription
            ? subscription.cancelAtPeriodEnd
              ? t("current.ends", {
                  date: f.date(subscription.currentPeriodEnd),
                })
              : t("current.renews", {
                  date: f.date(subscription.currentPeriodEnd),
                })
            : t("current.freeResets", { date: f.date(overview.period.end) })}
        </p>
        <div className="mt-4 flex flex-col gap-3 empty:hidden">
          {subscription?.status === "past_due" ? (
            <Notice tone="warning">
              {t("status.pastDue", { plan: f.plan(plan) })}
            </Notice>
          ) : null}
          {subscription?.cancelAtPeriodEnd ? (
            <Notice tone="warning">
              {t("status.cancelling", {
                plan: f.plan(plan),
                date: f.date(subscription.currentPeriodEnd),
              })}
            </Notice>
          ) : null}
          {scheduled ? (
            <Notice>
              {t("status.scheduled", {
                plan: f.plan(scheduled.plan),
                date: f.date(scheduled.at),
              })}
            </Notice>
          ) : null}
        </div>
        {canManage && subscription?.cancelAtPeriodEnd ? (
          writesEnabled ? (
            <form action={resumePlanPageAction.bind(null, slug)}>
              <button
                type="submit"
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                {t("current.keepPlan", { plan: f.plan(plan) })}
              </button>
            </form>
          ) : (
            <a href={legacyUrl} className={textLink}>
              {t("current.legacyAction")}
            </a>
          )
        ) : null}
      </Section>

      <Section
        title={t("usage.title")}
        description={t("usage.period", {
          start: f.date(overview.period.start),
          end: f.lastDay(overview.period.end),
        })}
      >
        <UsageMeters overview={overview} />
        {atLimit && plan !== "enterprise" ? (
          <p className="mt-5 text-small text-fg-muted">
            {canManage ? t("usage.atLimit") : t("usage.atLimitAskOwner")}{" "}
            {canManage ? (
              <Link href={`${base}/plans`} className={textLink}>
                {t("usage.seePlans")}
              </Link>
            ) : null}
          </p>
        ) : null}
      </Section>

      <Section
        title={t("invoices.title")}
        description={
          canManage ? t("invoices.description") : t("current.ownerOnly")
        }
      >
        {canManage ? (
          <Suspense
            key={paymentPage}
            fallback={
              <div aria-busy className="mb-4 flex flex-col gap-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            }
          >
            <PaymentHistory workspace={slug} page={paymentPage} />
          </Suspense>
        ) : null}
        {canManage ? (
          <form action={portalPageAction.bind(null, slug)} className="mt-4">
            <button
              type="submit"
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {subscription?.status === "past_due"
                ? t("status.updatePayment")
                : t("invoices.open")}
              <ArrowUpRight aria-hidden className="text-fg-subtle" />
            </button>
          </form>
        ) : null}
      </Section>
    </Page>
  );
}
