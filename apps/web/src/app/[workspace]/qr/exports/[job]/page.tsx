import { getTranslations } from "next-intl/server";
import { Page } from "@/components/page/page";
import { QrExportProgress } from "@/components/qr/export-progress";
import { readQrExportAction } from "@/server/actions/qr-exports";

export async function generateMetadata() {
  return { title: (await getTranslations("qrExports"))("statusTitle") };
}
export default async function QrExportStatusPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/qr/exports/[job]">) {
  const { workspace, job } = await params,
    query = await searchParams;
  const kind = query.kind === "zip" ? "zip" : "single";
  const [initial, t, list] = await Promise.all([
    readQrExportAction(workspace, job, kind),
    getTranslations("qrExports"),
    getTranslations("qr.list"),
  ]);
  return (
    <Page
      crumbs={[
        { label: list("title"), href: `/${workspace}/qr` },
        { label: t("statusTitle") },
      ]}
      title={t("statusTitle")}
      width="form"
    >
      <QrExportProgress
        workspace={workspace}
        id={job}
        kind={kind}
        initial={initial}
      />
    </Page>
  );
}
