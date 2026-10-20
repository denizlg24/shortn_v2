import { can, pageTags } from "@shortn/core";
import { isTagSort } from "@shortn/core/tag-options";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { Pagination } from "@/components/page/pagination";
import { TagColorButton } from "@/components/tags/tag-color-picker";
import { TagLibraryToolbar } from "@/components/tags/tag-library-toolbar";
import { TagRowMenu } from "@/components/tags/tag-row-menu";
import { serviceContext } from "@/server/context";
import { tagLinksHref } from "@/server/tag-page";

const pageSize = 50;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export async function generateMetadata() {
  return { title: (await getTranslations("tags"))("title") };
}

export default async function TagsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/tags">) {
  const { workspace } = await params;
  const query = await searchParams;
  const [t, format, ctx] = await Promise.all([
    getTranslations("tags"),
    getFormatter(),
    serviceContext(workspace),
  ]);
  const search = one(query.q)?.slice(0, 200) ?? "";
  const sort = one(query.sort);
  const requested = Number(one(query.page));
  const result = await pageTags(ctx, {
    search,
    sort: isTagSort(sort) ? sort : "name",
    page: Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
    limit: pageSize,
  });
  const editable = can(ctx.actor, "resource.update");
  const base = `/${workspace}/tags`;
  const notice = ["saved", "merged", "deleted"].find(
    (flag) => one(query[flag]) === "1",
  );
  return (
    <Page crumbs={[{ label: t("title") }]} title={t("title")}>
      {notice === "saved" ? <Notice tone="success">{t("saved")}</Notice> : null}
      {notice === "merged" ? (
        <Notice tone="success">{t("merged")}</Notice>
      ) : null}
      {notice === "deleted" ? (
        <Notice tone="success">{t("deleted")}</Notice>
      ) : null}
      {!editable ? (
        <p className="mb-4 max-w-prose text-small text-fg-muted">
          {t("readOnly")}
        </p>
      ) : null}
      <TagLibraryToolbar total={result.total} />
      {result.items.length === 0 ? (
        <p className="py-16 text-center text-body text-fg-muted">
          {search ? t("emptyFiltered") : t("empty")}
        </p>
      ) : (
        <>
          <table className="w-full table-fixed text-small">
            <thead className="border-b border-line text-left text-meta text-fg-muted">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t("columns.tag")}
                </th>
                <th
                  scope="col"
                  title={t("linksHint")}
                  className="w-24 py-2 pr-4 text-right font-medium"
                >
                  {t("columns.links")}
                </th>
                <th
                  scope="col"
                  className="w-32 py-2 pr-4 text-right font-medium max-sm:hidden"
                >
                  {t("columns.created")}
                </th>
                <th scope="col" className="w-10 py-2">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.items.map((tag) => {
                const linksHref = tagLinksHref(workspace, tag.name);
                return (
                  <tr key={tag.id} className="h-11 hover:bg-bg-subtle">
                    <td className="py-1.5 pr-4">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <TagColorButton
                          workspace={workspace}
                          id={tag.id}
                          name={tag.name}
                          color={tag.color}
                          editable={editable}
                        />
                        {editable ? (
                          <Link
                            href={`${base}/${tag.id}`}
                            title={tag.name}
                            className="min-w-0 truncate font-medium text-fg hover:underline"
                          >
                            {tag.name}
                          </Link>
                        ) : (
                          <span
                            title={tag.name}
                            className="min-w-0 truncate font-medium text-fg"
                          >
                            {tag.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono tabular-nums">
                      {tag.links ? (
                        <Link
                          href={linksHref}
                          aria-label={t("viewLinksFor", { tag: tag.name })}
                          className="text-fg hover:underline"
                        >
                          {format.number(tag.links)}
                        </Link>
                      ) : (
                        <span className="text-fg-subtle">
                          {format.number(0)}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                      {format.dateTime(new Date(tag.createdAt), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-1.5 text-right">
                      <TagRowMenu
                        name={tag.name}
                        base={`${base}/${tag.id}`}
                        linksHref={linksHref}
                        editable={editable}
                        deletable={can(ctx.actor, "resource.delete", {
                          createdBy: tag.createdBy ?? undefined,
                        })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <Pagination
              page={result.page}
              pages={result.pages}
              params={Object.fromEntries(
                Object.entries(query).filter(
                  ([key]) => !["saved", "merged"].includes(key),
                ),
              )}
            />
          </div>
        </>
      )}
    </Page>
  );
}
