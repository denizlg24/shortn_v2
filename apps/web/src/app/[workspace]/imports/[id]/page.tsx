import Link from "next/link";
import { Fragment } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@shortn/ui";
import { Page } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { ImportJobPanel } from "@/components/imports/job";
import { ImportFilters } from "@/components/imports/filters";
import { importErrorKey } from "@/lib/imports";
import {
  readImportAction,
  listImportResultsAction,
  searchImportTagsAction,
} from "@/server/actions/imports";

export async function generateMetadata() {
  return { title: (await getTranslations("imports"))("title") };
}
export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace, id } = await params,
    query = await searchParams;
  const [result, t, format] = await Promise.all([
    readImportAction(workspace, id),
    getTranslations("imports"),
    getFormatter(),
  ]);
  const job = result.job,
    one = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] : value;
  const showRows =
    job &&
    ["ready", "completed", "failed", "cancelled"].includes(job.state) &&
    job.validated > 0;
  const [rows, tags] = showRows
    ? await Promise.all([
        listImportResultsAction(workspace, id, {
          page: Math.max(1, Math.floor(Number(one(query.page)) || 1)),
          ...(one(query.q) ? { search: one(query.q)!.slice(0, 200) } : {}),
          ...(one(query.tag) ? { tag: one(query.tag)!.slice(0, 64) } : {}),
          ...(one(query.status) ? { status: one(query.status) } : {}),
          ...(one(query.error)
            ? { error: one(query.error)!.slice(0, 64) }
            : {}),
          ...(one(query.group) ? { group: one(query.group) } : {}),
        }),
        searchImportTagsAction(workspace, id),
      ])
    : [null, null];
  const errorLabel = (code: string | undefined) =>
    code ? t(importErrorKey(code)) : t("valid");
  return (
    <Page
      crumbs={[
        { label: t("title"), href: `/${workspace}/imports` },
        { label: job ? t(job.kind) : t("title") },
      ]}
      title={job ? `${t("entry")} · ${t(job.kind)}` : t("title")}
      description={
        job
          ? t("expires", {
              date: format.dateTime(new Date(job.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : undefined
      }
      actions={
        <Link
          href={`/${workspace}/imports`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("history")}
        </Link>
      }
    >
      {job ? (
        <>
          <ImportJobPanel workspace={workspace} job={job} />
          {showRows ? (
            <section aria-labelledby="results-title">
              <h2 id="results-title" className="mb-4 text-body font-semibold">
                {t("results")}
              </h2>
              <ImportFilters
                workspace={workspace}
                id={id}
                tags={tags?.data?.items.map((item) => item.tag) ?? []}
                errors={Object.keys(job.counts)}
              />
              {rows?.data ? (
                <>
                  <p className="mb-3 text-small text-fg-muted">
                    {t("rowCount", { count: rows.data.total })}
                  </p>
                  <ol className="mb-6 divide-y divide-line border-y border-line">
                    {rows.data.items.map((row, index) => (
                      <Fragment key={row.position}>
                        {one(query.group) === "error" &&
                        (index === 0 ||
                          rows.data!.items[index - 1]?.error !== row.error) ? (
                          <li className="bg-bg-subtle px-3 py-2 text-small font-medium">
                            {errorLabel(row.error)}
                          </li>
                        ) : null}
                        <li className="flex min-w-0 items-start gap-3 py-4">
                          <span className="w-10 shrink-0 text-meta tabular-nums text-fg-muted">
                            {t("row")} {row.row}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-small font-medium"
                              title={row.title || row.url}
                            >
                              {row.title || row.url}
                            </p>
                            {row.title ? (
                              <p
                                className="mt-1 truncate text-meta text-fg-muted"
                                title={row.url}
                              >
                                {row.url}
                              </p>
                            ) : null}
                            {row.key ? (
                              <p className="mt-1 truncate font-mono text-meta text-fg-muted">
                                {row.key}
                              </p>
                            ) : null}
                            {row.tags.length ? (
                              <p className="mt-2 line-clamp-2 break-words text-meta text-fg-muted">
                                {row.tags.join(" · ")}
                              </p>
                            ) : null}
                            <p className="mt-2 text-small text-fg-muted">
                              {errorLabel(row.error)}
                            </p>
                          </div>
                        </li>
                      </Fragment>
                    ))}
                  </ol>
                  {!rows.data.items.length ? (
                    <p className="mb-6 text-small text-fg-muted">
                      {t("emptyResults")}
                    </p>
                  ) : null}
                  <Pagination
                    page={rows.data.page}
                    pages={Math.ceil(rows.data.total / rows.data.pageSize)}
                    params={query}
                  />
                </>
              ) : (
                <Notice tone="warning">
                  {t(
                    rows?.error === "invalid_input"
                      ? "errors.invalid_input"
                      : "errors.failed",
                  )}
                </Notice>
              )}
            </section>
          ) : null}
          <Link
            href={`/${workspace}/${job.kind}`}
            className="mt-5 inline-block text-small text-signal hover:underline"
          >
            {t("back")}
          </Link>
        </>
      ) : (
        <>
          <Notice tone="warning">
            {t(result.error === "not_found" ? "notFound" : "disabled")}
          </Notice>
          <Link
            href={`/${workspace}/imports/new`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("newAction")}
          </Link>
        </>
      )}
    </Page>
  );
}
