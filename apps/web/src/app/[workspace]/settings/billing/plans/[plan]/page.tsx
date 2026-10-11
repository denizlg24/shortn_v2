import type { PlanId } from "@shortn/billing";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { BillingConfirm } from "@/components/settings/billing/billing-confirm";
import { changePlanPageAction } from "@/server/actions/settings-pages";
import { billingFormat } from "@/server/billing-format";
import { billingOverview } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("plansPage.title") };
}

const paidPlans = ["basic", "plus", "pro"] as const;
const isPaid = (plan: string): plan is (typeof paidPlans)[number] =>
  paidPlans.some((paid) => paid === plan);
const rank: Record<PlanId, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
  enterprise: 4,
};

// Switching between paid plans (writes on): what changes and when, then confirm.
export default async function ChangePlanPage({
  params,
}: PageProps<"/[workspace]/settings/billing/plans/[plan]">) {
  const { workspace: slug, plan } = await params;
  const [overview, t, tSettings, f] = await Promise.all([
    billingOverview(slug),
    getTranslations("billing"),
    getTranslations("settings"),
    billingFormat(),
  ]);
  const { plan: current, subscription } = overview;
  const base = `/${slug}/settings/billing`;
  if (
    !isPaid(plan) ||
    plan === current ||
    !isPaid(current) ||
    !subscription ||
    !overview.canManage ||
    !overview.writesEnabled
  )
    redirect(`${base}/plans`);
  const upgrade = rank[plan] > rank[current];
  const title = upgrade
    ? t("change.upgradeTitle", { plan: f.plan(plan) })
    : t("change.downgradeTitle", { plan: f.plan(plan) });

  return (
    <Page
      crumbs={[
        { label: tSettings("title"), href: `/${slug}/settings` },
        { label: t("title"), href: base },
        { label: t("plansPage.title"), href: `${base}/plans` },
        { label: title },
      ]}
      title={title}
      width="form"
    >
      <BillingConfirm
        consequences={
          upgrade
            ? [
                t("change.upgradeNow", { plan: f.plan(plan) }),
                t("change.upgradeInvoice"),
              ]
            : [
                t("change.downgradeLater", {
                  plan: f.plan(plan),
                  current: f.plan(current),
                  date: f.date(subscription.currentPeriodEnd),
                }),
                t("change.downgradeLimits", { plan: f.plan(plan) }),
              ]
        }
        action={changePlanPageAction.bind(null, slug, plan)}
        submitLabel={t("compare.confirmAction", { plan: f.plan(plan) })}
        cancelLabel={t("compare.keep", { plan: f.plan(current) })}
        cancelHref={`${base}/plans`}
        tone="primary"
      />
    </Page>
  );
}
