import { getTranslations } from "next-intl/server";
import { LinkExportError, workspaceExportDelivery } from "@shortn/core";
import { Page } from "@/components/page/page";
import { WorkspaceExportProgress } from "@/components/settings/workspace-exports/progress";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import type { WorkspaceExportRead } from "@/lib/workspace-export";

export async function generateMetadata() {
  return { title: (await getTranslations("workspaceExports"))("statusTitle") };
}
export default async function WorkspaceExportStatusPage({
  params,
}: {
  params: Promise<{ workspace: string; job: string }>;
}) {
  const { workspace, job } = await params,
    [ctx, t, links] = await Promise.all([
      serviceContext(workspace),
      getTranslations("workspaceExports"),
      getTranslations("settings"),
    ]);
  const store = linkExportStore();
  let initial: WorkspaceExportRead = { job: null, error: "unavailable" };
  if (store)
    try {
      const value = await workspaceExportDelivery(ctx, job, store.sign);
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
        { label: links("title"), href: `/${workspace}/settings` },
        {
          label: t("history"),
          href: `/${workspace}/settings/workspace/exports`,
        },
        { label: t("statusTitle") },
      ]}
      title={t("statusTitle")}
      width="form"
    >
      <WorkspaceExportProgress
        key={`${workspace}:${job}`}
        workspace={workspace}
        id={job}
        initial={initial}
      />
    </Page>
  );
}
