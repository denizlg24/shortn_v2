import { can, listLinks, tagColorsByName } from "@shortn/core";
import { buttonVariants, cn } from "@shortn/ui";
import { Tags } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { LinkPasteCapture } from "@/components/link-pages/link-paste-capture";
import { Fragment } from "react";
import { HealthFlag } from "@/components/link-pages/health";
import { TrashSelection } from "@/components/link-pages/trash-selection";
import { LinkFiltersBar } from "@/components/link-filters/link-filters-bar";
import { BulkSelection } from "@/components/page/bulk-selection";
import { SelectPageCheckbox } from "@/components/page/selection-bar";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { Pagination } from "@/components/page/pagination";
import { TagChipList } from "@/components/tags/tag-chip";
import { serviceContext } from "@/server/context";
import { linksViewQuery, linksViewSearch } from "@/server/link-list-query";
import { linkExportStore } from "@/server/link-exports";
import { requestTime } from "@/server/time";
import { importStore } from "@/server/imports";
import { encodeSelection } from "@/lib/bulk-selection";
import { tourAnchor } from "@/lib/tour/anchors";

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
  const importText = await getTranslations("imports");
  const archiveText = await getTranslations("bulkArchive");
  const bulkCampaignText = await getTranslations("bulkCampaign");
  const bulkTagsText = await getTranslations("bulkTags");
  const trashText = await getTranslations("linkPages.trash");
  const healthText = await getTranslations("linkPages.health");
  const selectionText = await getTranslations("page.selection");
  const bioText = await getTranslations("bio.destination");
  const tagsText = await getTranslations("tags");
  const trash = one(query.trash) === "1",
    archived = !trash && one(query.archived) === "1";
  const format = await getFormatter();
  const ctx = await serviceContext(workspace);

  const view = linksViewQuery(query, requestTime());
  const result = await listLinks(ctx, {
    ...view.filter,
    page: view.page,
    limit: pageSize,
  });
  const colors = await tagColorsByName(
    ctx,
    result.links.flatMap((link) => link.tags.map((tag) => tag.name)),
  );
  const exportText = await getTranslations("linkExports");
  const exportSearch = linksViewSearch(query);

  const canCreate = can(ctx.actor, "resource.create");
  const deletable = (link: (typeof result.links)[number]) =>
    can(ctx.actor, "resource.delete", {
      createdBy: link.createdBy ?? undefined,
    });
  const anyDeletable = result.links.some((link) =>
    trash ? deletable(link) : can(ctx.actor, "resource.update"),
  );
  const filtered = view.filtered;
  const deleted = Number(one(query.deleted));
  const now = requestTime().getTime();
  const eligible = result.links
    .filter(
      (link) =>
        (trash ? deletable(link) : can(ctx.actor, "resource.update")) &&
        (!trash ||
          (link.restoreUntil && new Date(link.restoreUntil).getTime() > now)),
    )
    .map((link) => link.id);
  const Selection = trash ? TrashSelection : BulkSelection;
  const groupOf = (link: (typeof result.links)[number]) =>
    link.tags[0]?.name ?? trashText("untagged");
  const grouped = (trash || archived) && one(query.group) === "tag";
  const rows = grouped
    ? [...result.links].sort((a, b) => groupOf(a).localeCompare(groupOf(b)))
    : result.links;
  const sectionLink = (href: string, current: boolean, label: string) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={buttonVariants({
        variant: current ? "secondary" : "ghost",
        size: "sm",
      })}
    >
      {label}
    </Link>
  );

  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={
        trash
          ? trashText("title")
          : archived
            ? archiveText("libraryTitle")
            : t("title")
      }
      actions={
        <>
          {linkExportStore() ? (
            <Link
              href={`/${workspace}/links/export${exportSearch ? `?${exportSearch}` : ""}`}
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              {exportText("entry")}
            </Link>
          ) : null}
          {canCreate && !trash ? (
            <>
              {importStore() ? (
                <Link
                  href={`/${workspace}/imports/new?kind=links`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  {importText("entry")}
                </Link>
              ) : null}
              <Link
                href={`/${workspace}/links/new`}
                className={buttonVariants({ variant: "primary", size: "lg" })}
                {...tourAnchor("links-new")}
              >
                {t("new")}
              </Link>
            </>
          ) : null}
        </>
      }
    >
      {canCreate ? <LinkPasteCapture workspace={workspace} /> : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav
          aria-label={trashText("sections")}
          className="flex flex-wrap gap-1"
          {...tourAnchor("links-library")}
        >
          {sectionLink(`/${workspace}/links`, !trash && !archived, t("title"))}
          {sectionLink(
            `/${workspace}/links?archived=1`,
            archived,
            archiveText("libraryTitle"),
          )}
          {sectionLink(
            `/${workspace}/links?trash=1`,
            trash,
            trashText("title"),
          )}
        </nav>
        <Link
          href={`/${workspace}/tags`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Tags aria-hidden />
          {tagsText("manage")}
        </Link>
      </div>
      {trash ? (
        <p className="mb-4 max-w-prose text-small text-fg-muted">
          {trashText("description")}
        </p>
      ) : null}
      {archived ? (
        <p className="mb-4 max-w-prose text-small text-fg-muted">
          {archiveText("libraryHelp")}
        </p>
      ) : null}
      {deleted > 0 ? (
        <Notice tone="success">{t("deleted", { count: deleted })}</Notice>
      ) : null}
      <div {...tourAnchor("links-filters")}>
        <LinkFiltersBar
          ctx={ctx}
          workspace={workspace}
          filter={view.filter}
          total={result.total}
          grouping={trash || archived}
        />
      </div>

      <Selection
        key={trash ? "trash" : archived ? "archived" : "active"}
        workspace={workspace}
        eligible={eligible}
        action={`/${workspace}/links/delete`}
        {...(!trash
          ? {
              actions: [
                {
                  href: `/${workspace}/links/bio`,
                  label: bioText("title"),
                  clear: false,
                },
                ...(archived
                  ? [
                      {
                        href: `/${workspace}/links/archive?mode=unarchive`,
                        label: archiveText("unarchive"),
                        clear: false,
                      },
                    ]
                  : [
                      {
                        href: `/${workspace}/links/archive`,
                        label: archiveText("entry"),
                        clear: false,
                      },
                      {
                        href: `/${workspace}/links/campaign`,
                        label: bulkCampaignText("entry"),
                        clear: false,
                      },
                      {
                        href: `/${workspace}/links/tags`,
                        label: bulkTagsText("entry"),
                        clear: false,
                      },
                    ]),
                {
                  href: `/${workspace}/links/delete`,
                  label: selectionText("delete"),
                  tone: "danger" as const,
                },
              ],
            }
          : {})}
        enabled={anyDeletable}
        allowed={can(ctx.actor, "resource.update")}
      >
        {result.links.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-body text-fg-muted">
              {filtered
                ? t("emptyFiltered")
                : trash
                  ? trashText("empty")
                  : archived
                    ? archiveText("emptyLibrary")
                    : t("empty")}
            </p>
            {!trash && !archived && !filtered && canCreate ? (
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
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead className="border-b border-line text-left text-meta text-fg-muted">
                  <tr>
                    {anyDeletable ? (
                      <th scope="col" className="w-10 py-2 pr-2 font-medium">
                        <SelectPageCheckbox
                          label={selectionText("selectPage")}
                        />
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
                    <th
                      scope="col"
                      className="py-2 pr-4 text-right font-medium"
                    >
                      {t("columns.clicks")}
                    </th>
                    <th
                      scope="col"
                      className="py-2 text-right font-medium max-sm:hidden"
                    >
                      {trash ? trashText("restoreUntil") : t("columns.created")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((link, index) => (
                    <Fragment key={link.id}>
                      {grouped &&
                      (index === 0 ||
                        groupOf(rows[index - 1]!) !== groupOf(link)) ? (
                        <tr>
                          <th
                            colSpan={6}
                            scope="colgroup"
                            className="bg-bg-subtle px-2 py-2 text-left text-small font-medium"
                          >
                            {groupOf(link)}
                          </th>
                        </tr>
                      ) : null}
                      <tr key={link.id} className="hover:bg-bg-subtle">
                        {anyDeletable ? (
                          <td className="py-2.5 pr-2">
                            {eligible.includes(link.id) ? (
                              <input
                                type="checkbox"
                                name="ids"
                                value={link.id}
                                aria-label={t("selectRow", { key: link.key })}
                                className="size-4 accent-[var(--color-signal)]"
                              />
                            ) : null}
                          </td>
                        ) : null}
                        <td className="py-2.5 pr-4">
                          {trash ? (
                            <span className="block max-w-64 truncate font-medium text-fg">
                              <span className="text-fg-muted">
                                {link.domain}/
                              </span>
                              {link.key}
                            </span>
                          ) : (
                            <Link
                              href={`/${workspace}/links/${link.id}`}
                              className="block max-w-48 truncate font-medium text-fg hover:underline md:max-w-80"
                            >
                              <span className="text-fg-muted">
                                {link.domain}/
                              </span>
                              {link.key}
                            </Link>
                          )}
                          {link.title ? (
                            <p className="max-w-48 truncate text-meta text-fg-muted md:max-w-80">
                              {link.title}
                            </p>
                          ) : null}
                          {!trash && can(ctx.actor, "resource.update") ? (
                            <Link
                              href={`/${workspace}/links/bio?selection=${encodeSelection([link.id])}`}
                              className="mt-1 inline-block text-meta text-signal hover:underline"
                            >
                              {bioText("title")}
                            </Link>
                          ) : null}
                          {!trash && link.health?.flagged ? (
                            <HealthFlag
                              href={`/${workspace}/links/${link.id}#destination-health`}
                              label={healthText("flag")}
                              accessibleLabel={healthText("flagFor", {
                                key: link.key,
                              })}
                            />
                          ) : null}
                          {trash && link.restoreUntil ? (
                            <p className="text-meta text-fg-muted sm:hidden">
                              {new Date(link.restoreUntil).getTime() > now
                                ? trashText("until", {
                                    date: format.dateTime(
                                      new Date(link.restoreUntil),
                                      { day: "numeric", month: "short" },
                                    ),
                                  })
                                : trashText("expired")}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-96 truncate py-2.5 pr-4 text-fg-muted max-md:hidden">
                          {link.url}
                        </td>
                        <td className="py-2.5 pr-4 max-lg:hidden">
                          <TagChipList
                            tags={link.tags}
                            colors={colors}
                            moreLabel={(count) => tagsText("more", { count })}
                            className="max-w-72"
                          />
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                          {format.number(link.clicks)}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                          {trash &&
                          link.restoreUntil &&
                          new Date(link.restoreUntil).getTime() <= now
                            ? trashText("expired")
                            : format.dateTime(
                                new Date(
                                  trash
                                    ? (link.restoreUntil ?? link.createdAt)
                                    : link.createdAt,
                                ),
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <Pagination
                page={result.page ?? 1}
                pages={result.pages ?? 1}
                params={query}
              />
            </div>
          </>
        )}
      </Selection>
    </Page>
  );
}
