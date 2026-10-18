import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  authorizeWorkspaceExport,
  listWorkspaceExports,
  LinkExportError,
  WORKSPACE_EXPORT_MAX_BYTES,
} from "@shortn/core";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { WorkspaceExportForm } from "@/components/settings/workspace-exports/form";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import { workspaceExportErrorKey } from "@/lib/workspace-export";

export async function generateMetadata() {
  return { title: (await getTranslations("workspaceExports"))("title") };
}
export default async function WorkspaceExportPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params,
    [ctx, t, settings] = await Promise.all([
      serviceContext(workspace),
      getTranslations("workspaceExports"),
      getTranslations("settings"),
    ]);
  let review: { name: string; activeId?: string } | null = null,
    error = "unavailable";
  try {
    const current = await authorizeWorkspaceExport(ctx);
    if (linkExportStore()) {
      const [pending, running] = await Promise.all([
        listWorkspaceExports(ctx, { state: "pending" }),
        listWorkspaceExports(ctx, { state: "running" }),
      ]);
      const active = pending?.items[0] ?? running?.items[0];
      review = {
        name: current.name,
        ...(active ? { activeId: active.id } : {}),
      };
    }
  } catch (value) {
    error = value instanceof LinkExportError ? value.code : "failed";
  }
  return (
    <Page
      crumbs={[
        { label: settings("title"), href: `/${workspace}/settings` },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("description")}
      width="form"
    >
      {review ? (
        <>
          <h2 className="break-words text-body font-semibold">{review.name}</h2>
          <p className="mt-3 text-small text-fg-muted">{t("scopeHelp")}</p>
          <p className="mt-3 text-small text-fg-muted">
            {t("limits", { size: WORKSPACE_EXPORT_MAX_BYTES / 1024 ** 3 })}
          </p>
          <p className="my-5 text-small text-fg-muted">{t("deliveryHelp")}</p>
          <WorkspaceExportForm
            workspace={workspace}
            activeId={review.activeId}
          />
          <details className="mt-6 border-t border-line pt-5 text-small">
            <summary className="cursor-pointer rounded-control font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
              {t("contents")}
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-fg-muted">
              <li>{t("includes.content")}</li>
              <li>{t("includes.analytics")}</li>
              <li>{t("includes.state")}</li>
              <li>{t("includes.excluded")}</li>
              <li>{t("includes.images")}</li>
            </ul>
          </details>
          <p className="mt-5 text-meta text-fg-muted">{t("ownerHelp")}</p>
        </>
      ) : (
        <Notice tone="warning">{t(workspaceExportErrorKey(error))}</Notice>
      )}
      <Link
        href={`/${workspace}/settings`}
        className="mt-5 inline-block text-small text-signal hover:underline"
      >
        {t("back")}
      </Link>
    </Page>
  );
}
