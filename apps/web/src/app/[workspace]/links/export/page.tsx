import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  authorizeLinkExport,
  countFilteredLinkExport,
  cursorTags,
  LinkExportError,
  listLinks,
} from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { LinksFilters } from "@/components/link-pages/links-filters";
import { LinkExportForm } from "@/components/link-pages/export-form";
import { serviceContext } from "@/server/context";
import { linkExportStore } from "@/server/link-exports";
import {
  linksViewQuery,
  linksViewSearch,
  type LinkListQuery,
} from "@/server/link-list-query";
import { requestTime } from "@/server/time";
import { linkExportErrorKey } from "@/lib/link-export";

export async function generateMetadata() {
  return { title: (await getTranslations("linkExports"))("title") };
}
export default async function ExportLinksPage({
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
    getTranslations("linkExports"),
    getTranslations("linkPages.list"),
    getFormatter(),
  ]);
  const view = linksViewQuery(query, requestTime()),
    search = linksViewSearch(query),
    base = `/${workspace}/links`,
    back = `${base}${search ? `?${search}` : ""}`;
  let error: string | undefined;
  if (!linkExportStore()) error = "unavailable";
  else
    try {
      await authorizeLinkExport(ctx);
    } catch (value) {
      error = value instanceof LinkExportError ? value.code : "failed";
    }
  const [total, tagPage, result] = !error
    ? await Promise.all([
        countFilteredLinkExport(ctx, view.filter),
        cursorTags(ctx, { limit: 50 }),
        listLinks(ctx, { ...view.filter, page: view.page, limit: 25 }),
      ])
    : [0, null, null];
  const groups = new Map<string, NonNullable<typeof result>["links"]>();
  for (const link of result?.links ?? []) {
    const day = formatter.dateTime(new Date(link.createdAt), {
      dateStyle: "medium",
    });
    groups.set(day, [...(groups.get(day) ?? []), link]);
  }
  return (
    <Page
      crumbs={[{ label: links("title"), href: base }, { label: t("title") }]}
      title={t("title")}
      description={t("description")}
      actions={
        <Link
          href={`${base}/exports`}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          {t("history")}
        </Link>
      }
    >
      {error ? (
        <>
          <Notice tone="warning">{t(linkExportErrorKey(error))}</Notice>
          <div className="flex flex-wrap gap-3">
            {error === "feature_required" ? (
              <Link
                href={`/${workspace}/settings/billing`}
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                {t("plan")}
              </Link>
            ) : null}
            <Link
              href={back}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {t("back")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <Section title={t("output")}>
            <LinkExportForm
              key={`${JSON.stringify(view.filter)}:${total}`}
              workspace={workspace}
              filter={view.filter}
              count={total}
              back={back}
            />
          </Section>
          <Section title={t("review")} description={t("reviewHelp")}>
            <LinksFilters
              workspace={workspace}
              tags={tagPage?.items.map((tag) => tag.name) ?? []}
              trash={view.trash}
              archived={Boolean(view.filter.archived)}
            />
            <p className="mb-4 text-small text-fg-muted">
              {t("scope", { count: total })}
            </p>
            {result?.links.length ? (
              [...groups].map(([day, rows]) => (
                <div key={day} className="mb-6">
                  <h3 className="mb-2 text-small font-medium">{day}</h3>
                  <ul className="divide-y divide-line border-y border-line">
                    {rows.map((link) => (
                      <li key={link.id} className="min-w-0 py-3">
                        <Link
                          href={`${base}/${link.id}`}
                          title={link.title || link.url}
                          className="block truncate text-small font-medium hover:underline"
                        >
                          {link.title || link.url}
                        </Link>
                        <p className="mt-1 truncate font-mono text-meta text-fg-muted">
                          {link.domain}/{link.key}
                        </p>
                        <p
                          className="mt-1 truncate text-meta text-fg-muted"
                          title={link.url}
                        >
                          {link.url}
                        </p>
                        {link.tags.length ? (
                          <p className="mt-2 line-clamp-2 break-words text-meta text-fg-muted">
                            {link.tags.map((tag) => tag.name).join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="py-6 text-small text-fg-muted">{t("empty")}</p>
            )}
            {result ? (
              <div className="flex flex-wrap justify-end">
                <Pagination
                  page={view.page}
                  pages={Math.max(1, Math.ceil(total / 25))}
                  params={query}
                />
              </div>
            ) : null}
          </Section>
        </>
      )}
    </Page>
  );
}
