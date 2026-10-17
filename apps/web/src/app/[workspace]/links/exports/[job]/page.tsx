import { getTranslations } from "next-intl/server";
import { LinkExportError, linkExportDelivery } from "@shortn/core";
import { Page } from "@/components/page/page";
import { LinkExportProgress } from "@/components/link-pages/export-progress";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import type { LinkExportRead } from "@/lib/link-export";

export async function generateMetadata() {
  return { title: (await getTranslations("linkExports"))("statusTitle") };
}
export default async function LinkExportStatusPage({
  params,
}: {
  params: Promise<{ workspace: string; job: string }>;
}) {
  const { workspace, job } = await params,
    [ctx, t, links] = await Promise.all([
      serviceContext(workspace),
      getTranslations("linkExports"),
      getTranslations("linkPages.list"),
    ]);
  const store = linkExportStore();
  let initial: LinkExportRead = { job: null, error: "unavailable" };
  if (store)
    try {
      const value = await linkExportDelivery(ctx, job, store.sign);
      initial = value ? { job: value } : { job: null, error: "not_found" };
    } catch (value) {
      initial = {
        job: null,
        error:
          value instanceof LinkExportError ? value.code : "storage_unavailable",
      };
    }
  return (
    <Page
      crumbs={[
        { label: links("title"), href: `/${workspace}/links` },
        { label: t("history"), href: `/${workspace}/links/exports` },
        { label: t("statusTitle") },
      ]}
      title={t("statusTitle")}
      width="form"
    >
      <LinkExportProgress
        key={job}
        workspace={workspace}
        id={job}
        initial={initial}
      />
    </Page>
  );
}
