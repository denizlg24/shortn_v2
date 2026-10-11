import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { BillingConfirm } from "@/components/settings/billing/billing-confirm";
import { cancelPlanPageAction } from "@/server/actions/settings-pages";
import { billingFormat } from "@/server/billing-format";
import { billingOverview } from "@/server/plan";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("cancelPage.title") };
}

export default async function CancelPlanPage({
  params,
}: PageProps<"/[workspace]/settings/billing/cancel">) {
  const slug = (await params).workspace;
  const [overview, t, tSettings, f] = await Promise.all([
    billingOverview(slug),
    getTranslations("billing"),
    getTranslations("settings"),
    billingFormat(),
  ]);
  const { plan, subscription } = overview;
  const base = `/${slug}/settings/billing`;
  if (
    !subscription ||
    subscription.cancelAtPeriodEnd ||
    plan === "free" ||
    plan === "enterprise" ||
    !overview.canManage ||
    !overview.writesEnabled
  )
    redirect(base);
  const free = overview.catalog.find((item) => item.plan === "free");

  return (
    <Page
      crumbs={[
        { label: tSettings("title"), href: `/${slug}/settings` },
        { label: t("title"), href: base },
        { label: t("plansPage.title"), href: `${base}/plans` },
        { label: t("cancelPage.title") },
      ]}
      title={t("cancelPage.heading", { plan: f.plan(plan) })}
      width="form"
    >
      <BillingConfirm
        consequences={[
          t("cancelPage.keepUntil", {
            plan: f.plan(plan),
            date: f.date(subscription.currentPeriodEnd),
          }),
          t("cancelPage.thenFree", {
            links: free?.limits.links ?? 0,
            qrCodes: free?.limits.qrCodes ?? 0,
          }),
          t("cancelPage.undo", { plan: f.plan(plan) }),
        ]}
        action={cancelPlanPageAction.bind(null, slug)}
        submitLabel={t("current.cancelConfirmAction")}
        cancelLabel={t("current.keepPlan", { plan: f.plan(plan) })}
        cancelHref={`${base}/plans`}
        tone="danger"
      />
    </Page>
  );
}
