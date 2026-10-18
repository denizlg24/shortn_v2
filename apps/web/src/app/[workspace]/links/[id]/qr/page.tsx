import { collection } from "@shortn/db";
import { buttonVariants } from "@shortn/ui";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Page } from "@/components/page/page";
import { linkTabs, loadLink } from "@/server/link-page";

export async function generateMetadata() {
  const t = await getTranslations("linkPages.tabs");
  return { title: t("qr") };
}

export default async function LinkQrPage({
  params,
}: PageProps<"/[workspace]/links/[id]/qr">) {
  const { workspace, id } = await params;
  const t = await getTranslations("linkPages");
  const { ctx, link } = await loadLink(workspace, id);
  const qr = link.qrCodeId
    ? await collection(ctx.db, "qr_codes").findOne(
        { qrCodeId: link.qrCodeId, workspaceId: ctx.workspace._id },
        { projection: { _id: 1, qrCodeId: 1 } },
      )
    : null;
  return (
    <Page
      crumbs={[
        { label: t("crumb"), href: `/${workspace}/links` },
        {
          label: `${link.domain}/${link.key}`,
          href: `/${workspace}/links/${id}`,
        },
        { label: t("tabs.qr") },
      ]}
      title={`${link.domain}/${link.key}`}
      tabs={linkTabs(workspace, id, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
      width="form"
    >
      {qr ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-small">
            {t("qr.attached", { id: qr.qrCodeId ?? "" })}
          </p>
          <Link
            href={`/${workspace}/qr/${qr._id.toHexString()}`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("qr.open")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p className="text-small text-fg-muted">{t("qr.none")}</p>
          <Link
            href={`/${workspace}/qr/new?link=${id}`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("qr.create")}
          </Link>
        </div>
      )}
    </Page>
  );
}
