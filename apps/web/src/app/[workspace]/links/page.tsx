import {
  can,
  isCreatedWindow,
  isLinkSort,
  isLinkStatus,
  listLinks,
  listTags,
} from "@shortn/core";
import { buttonVariants, cn } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { LinksFilters } from "@/components/link-pages/links-filters";
import { Pagination } from "@/components/page/pagination";
import { serviceContext } from "@/server/context";
import { daysAgo } from "@/server/time";

const pageSize = 25;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export async function generateMetadata() {
  const t = await getTranslations("linkPages.list");
  return { title: t("title") };
}

export default async function LinksPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links">) {
  const { workspace } = await params;
  const query = await searchParams;
  const t = await getTranslations("linkPages.list");
  const format = await getFormatter();
  const ctx = await serviceContext(workspace);

  const search = one(query.q)?.slice(0, 200);
  const tag = one(query.tag);
  const status = one(query.status);
  const created = one(query.created);
  const sort = one(query.sort);
  const pageNumber = Math.max(1, Number(one(query.page)) || 1);

  const [tags, result] = await Promise.all([
    listTags(ctx),
    listLinks(ctx, {
      search,
      tags: tag ? [tag] : undefined,
      status: isLinkStatus(status) ? status : undefined,
      createdAfter: isCreatedWindow(created)
        ? daysAgo(Number(created))
        : undefined,
      sort: isLinkSort(sort) ? sort : "newest",
      page: pageNumber,
      limit: pageSize,
    }),
  ]);

  const canCreate = can(ctx.actor, "resource.create");
  const filtered = Boolean(search || tag || status || created);
  const deleted = Number(one(query.deleted));

  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("count", { count: result.total ?? 0 })}
      actions={
        canCreate ? (
          <Link
            href={`/${workspace}/links/new`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("new")}
          </Link>
        ) : null
      }
    >
      {deleted > 0 ? (
        <Notice tone="success">{t("deleted", { count: deleted })}</Notice>
      ) : null}
      <LinksFilters tags={tags.map((item) => item.name)} />

      {result.links.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-body text-fg-muted">
            {filtered ? t("emptyFiltered") : t("empty")}
          </p>
          {!filtered && canCreate ? (
            <Link
              href={`/${workspace}/links/new`}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "mt-4",
              )}
            >
              {t("new")}
            </Link>
          ) : null}
        </div>
      ) : (
        <form method="get" action={`/${workspace}/links/delete`}>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="border-b border-line text-left text-meta text-fg-muted">
                <tr>
                  {canCreate ? (
                    <th scope="col" className="w-10 py-2 pr-2 font-medium">
                      <span className="sr-only">{t("columns.select")}</span>
                    </th>
                  ) : null}
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t("columns.link")}
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 font-medium max-md:hidden"
                  >
                    {t("columns.destination")}
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 font-medium max-lg:hidden"
                  >
                    {t("columns.tags")}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    {t("columns.clicks")}
                  </th>
                  <th
                    scope="col"
                    className="py-2 text-right font-medium max-sm:hidden"
                  >
                    {t("columns.created")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.links.map((link) => (
                  <tr key={link.id} className="hover:bg-bg-subtle">
                    {canCreate ? (
                      <td className="py-2.5 pr-2">
                        <input
                          type="checkbox"
                          name="ids"
                          value={link.id}
                          aria-label={t("selectRow", { key: link.key })}
                          className="size-4 accent-[var(--color-signal)]"
                        />
                      </td>
                    ) : null}
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/${workspace}/links/${link.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        <span className="text-fg-muted">{link.domain}/</span>
                        {link.key}
                      </Link>
                      {link.title ? (
                        <p className="truncate text-meta text-fg-muted md:max-w-80">
                          {link.title}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-96 truncate py-2.5 pr-4 text-fg-muted max-md:hidden">
                      {link.url}
                    </td>
                    <td className="py-2.5 pr-4 max-lg:hidden">
                      <span className="flex flex-wrap gap-1">
                        {link.tags.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-chip bg-bg-muted px-1.5 py-0.5 text-meta"
                          >
                            {item.name}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                      {format.number(link.clicks)}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                      {format.dateTime(new Date(link.createdAt), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {canCreate ? (
              <button
                type="submit"
                className={buttonVariants({ variant: "secondary", size: "md" })}
              >
                {t("deleteSelected")}
              </button>
            ) : (
              <span />
            )}
            <Pagination
              page={result.page ?? 1}
              pages={result.pages ?? 1}
              params={query}
            />
          </div>
        </form>
      )}
    </Page>
  );
}
