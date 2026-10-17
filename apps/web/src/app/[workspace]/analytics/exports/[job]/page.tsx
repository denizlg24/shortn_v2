import { getTranslations } from "next-intl/server";
import { LinkExportError, analyticsExportDelivery } from "@shortn/core";
import { Page } from "@/components/page/page";
import { AnalyticsExportProgress } from "@/components/analytics/export-progress";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import type { AnalyticsExportRead } from "@/lib/analytics-export";

export async function generateMetadata() {
  return { title: (await getTranslations("analyticsExports"))("statusTitle") };
}
export default async function AnalyticsExportStatusPage({
  params,
}: {
  params: Promise<{ workspace: string; job: string }>;
}) {
  const { workspace, job } = await params,
    [ctx, t, links] = await Promise.all([
      serviceContext(workspace),
      getTranslations("analyticsExports"),
      getTranslations("analytics"),
    ]);
  const store = linkExportStore();
  let initial: AnalyticsExportRead = { job: null, error: "unavailable" };
  if (store)
    try {
      const value = await analyticsExportDelivery(ctx, job, store.sign);
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
        { label: links("title"), href: `/${workspace}/analytics` },
        { label: t("history"), href: `/${workspace}/analytics/exports` },
        { label: t("statusTitle") },
      ]}
      title={t("statusTitle")}
      width="form"
    >
      <AnalyticsExportProgress
        key={job}
        workspace={workspace}
        id={job}
        initial={initial}
      />
    </Page>
  );
}
