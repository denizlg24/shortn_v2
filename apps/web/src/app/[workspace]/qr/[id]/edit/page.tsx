import { listTags } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { QrDetailsForm } from "@/components/qr/qr-details-form";
import { updateQrDetailsPageAction } from "@/server/actions/qr-pages";
import { loadQr, qrName, qrTabs } from "@/server/qr-page";

export async function generateMetadata() {
  const t = await getTranslations("qr.tabs");
  return { title: t("edit") };
}

export default async function QrDetailsPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/edit">) {
  const { workspace, id } = await params;
  const t = await getTranslations("qr");
  const { ctx, qr } = await loadQr(workspace, id);
  const base = `/${workspace}/qr/${id}`;
  if (!can(ctx.actor, "resource.update")) redirect(base);
  const tags = await listTags(ctx);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: qrName(qr), href: base },
        { label: t("tabs.edit") },
      ]}
      title={qrName(qr)}
      description={t("form.editDescription")}
      tabs={qrTabs(workspace, id, true, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      <QrDetailsForm
        initial={{
          url: qr.url,
          title: qr.title,
          tags: qr.tags.map((tag) => tag.name),
        }}
        attachedLink={qr.attachedLinkKey}
        allTags={tags}
        action={updateQrDetailsPageAction.bind(null, workspace, id)}
        cancelHref={base}
      />
    </Page>
  );
}
