import { scaled } from "@/components/qr/qr-render";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@shortn/ui";
import { planQrPrint } from "@shortn/qr-render/print";
import { can } from "@shortn/core/authz";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { QrExportForm } from "@/components/qr/export-form";
import { QrImage } from "@/components/qr/qr-image";
import { printedOptions } from "@/components/qr/qr-options";
import { encodeSelection } from "@/lib/bulk-selection";
import { loadQr, qrName } from "@/server/qr-page";
import { qrExportStore } from "@/server/qr-exports";

export async function generateMetadata() {
  return { title: (await getTranslations("qrExports"))("singleTitle") };
}
export default async function ExportQrPage({
  params,
}: PageProps<"/[workspace]/qr/[id]/export">) {
  const { workspace, id } = await params,
    { qr, ctx } = await loadQr(workspace, id),
    t = await getTranslations("qrExports");
  const base = `/${workspace}/qr/${id}`;
  let plan: ReturnType<typeof planQrPrint> | undefined,
    error: string | undefined;
  try {
    plan = planQrPrint(qr.storedDesign, qr.shortUrl);
  } catch (value) {
    error = value instanceof Error ? value.message : "invalid_design";
  }
  const options = scaled(printedOptions(qr.storedDesign, qr.shortUrl), 1024);
  return (
    <Page
      crumbs={[
        {
          label: (await getTranslations("qr.list"))("title"),
          href: `/${workspace}/qr`,
        },
        {
          label: new URL(qr.shortUrl).pathname.split("/").at(-1) || qrName(qr),
          href: base,
        },
        { label: t("singleTitle") },
      ]}
      title={t("singleTitle")}
      description={t("singleDescription")}
      width="form"
    >
      {!qrExportStore() ? (
        <>
          <Notice tone="warning">{t("disabled")}</Notice>
          <Link
            href={base}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("back")}
          </Link>
        </>
      ) : (
        <>
          <div className="mb-6 flex min-w-0 items-center gap-5 border-y border-line py-5 max-sm:flex-col max-sm:items-start">
            {plan ? (
              <QrImage options={options} size={160} alt={t("previewAlt")} />
            ) : null}
            <div className="min-w-0">
              <p
                className="line-clamp-2 break-all text-body font-medium"
                title={qrName(qr)}
              >
                {qrName(qr)}
              </p>
              <p className="mt-1 break-all font-mono text-meta text-fg-muted">
                {qr.shortUrl}
              </p>
            </div>
          </div>
          <QrExportForm
            workspace={workspace}
            selection={encodeSelection([id])}
            count={1}
            bundle={false}
            cancelHref={base}
            {...(error ? { error } : {})}
            {...(plan ? { minimumMm: plan.minimumPrintMm } : {})}
          />
          {error ? (
            <Link
              href={can(ctx.actor, "resource.update") ? `${base}/design` : base}
              className="mt-4 inline-block text-small text-signal hover:underline"
            >
              {t(
                can(ctx.actor, "resource.update")
                  ? "reviewDesign"
                  : "reviewCode",
              )}
            </Link>
          ) : null}
        </>
      )}
    </Page>
  );
}
