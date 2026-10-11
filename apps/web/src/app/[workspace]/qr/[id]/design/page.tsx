import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { QrDesignForm } from "@/components/qr/qr-design-form";
import { gateOf } from "@/lib/plan-features";
import { saveQrDesignPageAction } from "@/server/actions/qr-pages";
import { featureAccess } from "@/server/plan";
import { loadQr, qrName, qrTabs } from "@/server/qr-page";

export async function generateMetadata() {
  const t = await getTranslations("qr.tabs");
  return { title: t("design") };
}

export default async function QrDesignPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/design">) {
  const { workspace, id } = await params;
  const t = await getTranslations("qr");
  const [{ ctx, qr }, logo] = await Promise.all([
    loadQr(workspace, id),
    featureAccess(workspace, "qrLogo"),
  ]);
  const base = `/${workspace}/qr/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: qrName(qr), href: base },
        { label: t("tabs.design") },
      ]}
      title={qrName(qr)}
      description={t("design.description")}
      tabs={qrTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      <QrDesignForm
        design={qr.design}
        stored={qr.storedDesign}
        shortUrl={qr.shortUrl}
        linkLabel={qr.shortUrl.replace(/^https?:\/\//, "")}
        logoGate={gateOf(logo)}
        action={saveQrDesignPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
