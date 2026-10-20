import { defaultQrDesign, getLink, listTags } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { QrCreateForm } from "@/components/qr/qr-create-form";
import { gateOf } from "@/lib/plan-features";
import { createQrPageAction } from "@/server/actions/qr-pages";
import { serviceContext } from "@/server/context";
import { env } from "@/server/env";
import { objectIds } from "@/server/form-data";
import { featureAccess } from "@/server/plan";

export async function generateMetadata() {
  const t = await getTranslations("qr.form");
  return { title: t("newTitle") };
}

export default async function NewQrPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr/new">) {
  const { workspace } = await params;
  const { link: linkParam } = await searchParams;
  const t = await getTranslations("qr");
  const [ctx, logo] = await Promise.all([
    serviceContext(workspace),
    featureAccess(workspace, "qrLogo"),
  ]);
  if (!can(ctx.actor, "resource.create")) redirect(`/${workspace}/qr`);
  const [linkId] = objectIds([linkParam]);
  const [tags, link] = await Promise.all([
    listTags(ctx),
    linkId ? getLink(ctx, linkId) : null,
  ]);
  // Same length as a real short URL, so the preview has the real density.
  const previewData = `https://${env().LINK_DOMAIN}/000000`;
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: t("form.newTitle") },
      ]}
      title={t("form.newTitle")}
      description={t("form.newDescription")}
    >
      <QrCreateForm
        base={defaultQrDesign(previewData)}
        previewData={previewData}
        allTags={tags}
        logoGate={gateOf(logo)}
        initialLink={
          link
            ? {
                id: link.id,
                domain: link.domain,
                key: link.key,
                url: link.url,
                qrCodeId: link.qrCodeId,
              }
            : null
        }
        workspace={workspace}
        action={createQrPageAction.bind(null, workspace)}
        cancelHref={
          link ? `/${workspace}/links/${link.id}/qr` : `/${workspace}/qr`
        }
      />
    </Page>
  );
}
