import type { PlanId } from "@shortn/billing";
import { buttonVariants } from "@shortn/ui";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import { CheckoutButton } from "@/components/settings/billing/checkout-button";
import { PlanCompare } from "@/components/settings/billing/plan-compare";
import {
  checkoutPageAction,
  resumePlanPageAction,
} from "@/server/actions/settings-pages";
import { billingFormat } from "@/server/billing-format";
import { billingOverview } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("plansPage.title") };
}

import { exchangeRate } from "@/server/exchange-rate";
import { ExchangeRateNote } from "@/components/settings/billing/exchange-rate-note";

const paidPlans = ["basic", "plus", "pro"] as const;
type PaidPlan = (typeof paidPlans)[number];
const isPaid = (plan: PlanId): plan is PaidPlan =>
  paidPlans.some((paid) => paid === plan);
const rank: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
  enterprise: 4,
};

export default async function PlansPage({
  params,
}: PageProps<"/[workspace]/settings/billing/plans">) {
  const slug = (await params).workspace;
  const [overview, t, tSettings, f, locale, rate] = await Promise.all([
    billingOverview(slug),
    getTranslations("billing"),
    getTranslations("settings"),
    billingFormat(),
    getLocale(),
    exchangeRate(),
  ]);
  const { plan: current, subscription, writesEnabled, canManage } = overview;
  const base = `/${slug}/settings/billing`;
  const legacyUrl = `https://shortn.at/${locale}/dashboard/settings/plan`;
  const subscribed = isPaid(current) && subscription !== null;
  const canSwitch = canManage && writesEnabled && subscribed;
  const textLink = "font-medium text-signal hover:underline";
  const linkButton = (href: string, label: string) => (
    <Link
      href={href}
      className={buttonVariants({
        variant: "secondary",
        size: "sm",
        className: "w-full",
      })}
    >
      {label}
    </Link>
  );

  const actions: Partial<Record<PlanId, ReactNode>> = {};
  for (const { plan } of overview.catalog) {
    if (plan === current || !canManage) continue;
    if (current === "free" && isPaid(plan))
      actions[plan] = (
        <CheckoutButton
          label={t("compare.upgradeTo", { plan: f.plan(plan) })}
          action={checkoutPageAction.bind(null, slug, plan)}
        />
      );
    else if (canSwitch && isPaid(plan))
      actions[plan] = linkButton(
        `${base}/plans/${plan}`,
        rank[plan] > rank[current]
          ? t("compare.upgradeTo", { plan: f.plan(plan) })
          : t("compare.switchTo", { plan: f.plan(plan) }),
      );
    else if (canSwitch && plan === "free" && !subscription.cancelAtPeriodEnd)
      actions[plan] = linkButton(
        `${base}/cancel`,
        t("compare.switchTo", { plan: f.plan(plan) }),
      );
  }

  return (
    <Page
      crumbs={[
        { label: tSettings("title"), href: `/${slug}/settings` },
        { label: t("title"), href: base },
        { label: t("plansPage.title") },
      ]}
      title={t("plansPage.title")}
      description={t("compare.description")}
    >
      {!canManage ? <Notice>{t("current.ownerOnly")}</Notice> : null}
      {canManage && subscribed && !writesEnabled ? (
        <Notice>
          {t("current.legacy")}{" "}
          <a href={legacyUrl} className={textLink}>
            {t("current.legacyAction")}
          </a>
        </Notice>
      ) : null}
      {current === "enterprise" ? (
        <Notice>{t("compare.enterprise")}</Notice>
      ) : null}

      <PlanCompare
        overview={overview}
        actions={actions}
        eurPerUsd={rate?.eurPerUsd ?? null}
      />
      <ExchangeRateNote rate={rate} />

      {canManage && subscribed ? (
        <div className="mt-8">
          <Section
            title={t("cancelPage.sectionTitle")}
            description={
              subscription.cancelAtPeriodEnd
                ? t("status.cancelling", {
                    plan: f.plan(current),
                    date: f.date(subscription.currentPeriodEnd),
                  })
                : t("cancelPage.sectionDescription", {
                    plan: f.plan(current),
                    date: f.date(subscription.currentPeriodEnd),
                  })
            }
          >
            {!writesEnabled ? (
              <a href={legacyUrl} className={textLink}>
                {t("current.legacyAction")}
              </a>
            ) : subscription.cancelAtPeriodEnd ? (
              <form action={resumePlanPageAction.bind(null, slug)}>
                <button
                  type="submit"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "md",
                  })}
                >
                  {t("current.keepPlan", { plan: f.plan(current) })}
                </button>
              </form>
            ) : (
              <Link
                href={`${base}/cancel`}
                className={buttonVariants({
                  variant: "dangerGhost",
                  size: "md",
                })}
              >
                {t("current.cancel")}
              </Link>
            )}
          </Section>
        </div>
      ) : null}
    </Page>
  );
}
