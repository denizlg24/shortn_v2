import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BillingPanel } from "@/components/settings/billing/billing-panel";
import { SettingsPage } from "@/components/settings/section";
import { billingOverviewAction } from "@/server/actions/billing";
import { requireWorkspace } from "@/server/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: `${t("nav.billing")} · ${t("title")}` };
}

export default async function BillingSettingsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/settings/billing">) {
  const slug = (await params).workspace;
  const [{ workspace }, overview, { checkout }, locale, t] = await Promise.all([
    requireWorkspace(slug),
    billingOverviewAction(slug),
    searchParams,
    getLocale(),
    getTranslations("billing"),
  ]);

  return (
    <SettingsPage
      title={t("title")}
      description={t("description", { workspace: workspace.name })}
    >
      <BillingPanel
        overview={overview}
        workspace={{ slug: workspace.slug, name: workspace.name }}
        checkoutReturned={typeof checkout === "string" && checkout.length > 0}
        legacyUrl={`https://shortn.at/${locale}/dashboard/settings/plan`}
      />
    </SettingsPage>
  );
}
