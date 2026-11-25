import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { QrShortLinkForm } from "@/components/qr/qr-short-link-form";
import { createQrShortLinkPageAction } from "@/server/actions/qr-pages";
import { loadQr, qrName } from "@/server/qr-page";
import { planFeatures } from "@/server/plan";

export async function generateMetadata() {
  return { title: (await getTranslations("qr.share"))("create") };
}

export default async function QrShortLinkPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/link">) {
  const { workspace, id } = await params;
  const { ctx, qr } = await loadQr(workspace, id);
  const base = `/${workspace}/qr/${id}`;
  if (!can(ctx.actor, "resource.create") || !can(ctx.actor, "resource.update"))
    notFound();
  if (qr.attachedLinkKey) redirect(base);
  const t = await getTranslations("qr.share");
  const features = await planFeatures(workspace);
  return (
    <Page
      crumbs={[{ label: qrName(qr), href: base }, { label: t("create") }]}
      title={t("create")}
      description={t("description")}
      width="form"
    >
      <p className="mb-5 break-words text-small text-fg-muted">
        {t("destination", { url: qr.url })}
      </p>
      <QrShortLinkForm
        domain={ctx.linkDomain}
        customKeys={features.customKeys.allowed}
        action={createQrShortLinkPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
