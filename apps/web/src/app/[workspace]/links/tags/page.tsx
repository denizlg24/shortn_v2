import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, cursorTags, pageBulkTagLinks } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { LinkFiltersBar } from "@/components/link-filters/link-filters-bar";
import { BulkTagsForm } from "@/components/link-pages/bulk-tags-form";
import { serviceContext } from "@/server/context";
import {
  saveBulkTagSelection,
  readBulkTagSelection,
} from "@/server/bulk-link-tags";
import { decodeSelection } from "@/lib/bulk-selection";
import { linksViewQuery } from "@/server/link-list-query";
import { requestTime } from "@/server/time";
export async function generateMetadata() {
  return { title: (await getTranslations("bulkTags"))("title") };
}
export default async function BulkTagsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/tags">) {
  const { workspace } = await params,
    query = await searchParams,
    ctx = await serviceContext(workspace),
    t = await getTranslations("bulkTags"),
    base = `/${workspace}/links`;
  const incoming = decodeSelection(query.selection);
  if (incoming.length && can(ctx.actor, "resource.update")) {
    const ref = await saveBulkTagSelection(ctx, incoming);
    if (ref) redirect(`${base}/tags?selectionRef=${ref}`);
  }
  const ids = await readBulkTagSelection(ctx, query.selectionRef),
    ref = typeof query.selectionRef === "string" ? query.selectionRef : "";
  const view = linksViewQuery(query, requestTime());
  const [result, tags] = await Promise.all([
    ids.length
      ? pageBulkTagLinks(ctx, ids, { ...view.filter, page: view.page })
      : null,
    can(ctx.actor, "resource.update") ? cursorTags(ctx, { limit: 50 }) : null,
  ]);
  const valid = result && result.selected === ids.length,
    groups = new Map<string, NonNullable<typeof result>["items"]>();
  for (const link of result?.items ?? []) {
    const group = link.tags[0]?.name ?? t("untagged");
    groups.set(group, [...(groups.get(group) ?? []), link]);
  }
  return (
    <Page
      crumbs={[
        {
          label: (await getTranslations("linkPages.list"))("title"),
          href: base,
        },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("limits")}
      width="form"
    >
      {!valid ? (
        <>
          <Notice tone="warning">
            {t(
              can(ctx.actor, "resource.update")
                ? "errors.not_found"
                : "errors.forbidden",
            )}
          </Notice>
          <Link
            href={base}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            {t("back")}
          </Link>
        </>
      ) : (
        <>
          <Section
            title={t("operation")}
            description={t("selection", { count: ids.length })}
          >
            <BulkTagsForm
              workspace={workspace}
              selectionRef={ref}
              count={ids.length}
              initial={tags?.items.map((tag) => tag.name) ?? []}
            />
          </Section>
          <Section
            title={t("review")}
            description={t("reviewHelp", { count: ids.length })}
          >
            <LinkFiltersBar
              ctx={ctx}
              workspace={workspace}
              filter={view.filter}
              counts={false}
            />
            <p className="mb-4 text-small text-fg-muted">
              {t("matching", { count: result.total, total: ids.length })}
            </p>
            {result.items.length ? (
              [...groups].map(([name, rows]) => (
                <div key={name} className="mb-5">
                  <h3 className="mb-2 break-words text-small font-medium">
                    {name}
                  </h3>
                  <ul className="divide-y divide-line border-y border-line">
                    {rows.map((link) => (
                      <li
                        key={link.id}
                        className="flex min-w-0 flex-col gap-1 py-3"
                      >
                        <Link
                          href={`${base}/${link.id}`}
                          title={link.title || `${link.domain}/${link.key}`}
                          className="truncate text-small font-medium hover:underline"
                        >
                          {link.title || `${link.domain}/${link.key}`}
                        </Link>
                        <p className="truncate font-mono text-meta text-fg-muted">
                          {link.domain}/{link.key}
                        </p>
                        {link.tags.length ? (
                          <p className="line-clamp-2 text-meta text-fg-muted">
                            {link.tags.map((tag) => tag.name).join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="py-5 text-small text-fg-muted">
                {t("emptyReview")}
              </p>
            )}
            <Pagination
              page={result.page}
              pages={result.pages}
              params={query}
            />
          </Section>
        </>
      )}
    </Page>
  );
}
