import { can } from "@shortn/core/authz";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Page } from "@/components/page/page";
import { DeleteQrs } from "@/components/qr/qr-delete";
import { loadQr, qrName } from "@/server/qr-page";

export async function generateMetadata() {
  const t = await getTranslations("qr.deletePage");
  return { title: t("title", { count: 1 }) };
}

export default async function DeleteQrPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/delete">) {
  const { workspace, id } = await params;
  const t = await getTranslations("qr");
  const { ctx, qr } = await loadQr(workspace, id);
  const base = `/${workspace}/qr/${id}`;
  if (
    !can(ctx.actor, "resource.delete", { createdBy: qr.createdBy ?? undefined })
  )
    redirect(base);
  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/qr` },
        { label: qrName(qr), href: base },
        { label: t("deletePage.title", { count: 1 }) },
      ]}
      title={t("deletePage.title", { count: 1 })}
      description={t("deletePage.description")}
      width="form"
    >
      <DeleteQrs
        workspace={workspace}
        ids={[qr.id]}
        items={[
          `${qrName(qr)} · ${qr.shortUrl.replace(/^https?:\/\//, "")} → ${qr.url}`,
        ]}
        attached={Boolean(qr.attachedLinkKey)}
        cancelHref={base}
      />
    </Page>
  );
}
