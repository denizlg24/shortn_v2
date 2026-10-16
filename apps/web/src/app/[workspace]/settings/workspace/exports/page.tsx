import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { LinkExportError, listWorkspaceExports } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { WorkspaceExportHistoryFilters } from "@/components/settings/workspace-exports/history-filters";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import { workspaceExportErrorKey } from "@/lib/workspace-export";
import type { LinkListQuery } from "@/server/link-list-query";

export async function generateMetadata() {
  return { title: (await getTranslations("workspaceExports"))("history") };
}
export default async function WorkspaceExportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<LinkListQuery>;
}) {
  const { workspace } = await params,
    query = await searchParams;
  const [ctx, t, links, formatter] = await Promise.all([
    serviceContext(workspace),
    getTranslations("workspaceExports"),
    getTranslations("settings"),
    getFormatter(),
  ]);
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  let result: Awaited<ReturnType<typeof listWorkspaceExports>> | null = null,
    error = "unavailable";
  if (linkExportStore())
    try {
      result = await listWorkspaceExports(ctx, {
        page: Number(one(query.page)) || 1,
        ...(one(query.state) ? { state: one(query.state)! } : {}),
      });
    } catch (value) {
      error = value instanceof LinkExportError ? value.code : "failed";
    }
  return (
    <Page
      crumbs={[
        { label: links("title"), href: `/${workspace}/settings` },
        { label: t("history") },
      ]}
      title={t("history")}
      description={t("historyHelp")}
      actions={
        <Link
          href={`/${workspace}/settings/workspace/export`}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          {t("new")}
        </Link>
      }
    >
      {result ? (
        <>
          <WorkspaceExportHistoryFilters />
          <ul className="mb-6 divide-y divide-line border-y border-line">
            {result.items.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/${workspace}/settings/workspace/exports/${job.id}`}
                    className="text-small font-medium text-signal hover:underline"
                  >
                    ZIP ·{" "}
                    {formatter.dateTime(new Date(job.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Link>
                  <p className="mt-1 text-meta text-fg-muted">
                    {t("progress", { done: formatter.number(job.done) })}
                  </p>
                </div>
                <p className="text-small text-fg-muted">
                  {t(`states.${job.state}`)}
                </p>
              </li>
            ))}
          </ul>
          {!result.items.length ? (
            <p className="mb-6 text-small text-fg-muted">{t("emptyHistory")}</p>
          ) : null}
          <Pagination page={result.page} pages={result.pages} params={query} />
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
