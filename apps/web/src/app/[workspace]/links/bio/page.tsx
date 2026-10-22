import { can, pageBulkTagLinks } from "@shortn/core";
import { getTranslations } from "next-intl/server";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { LinkFiltersBar } from "@/components/link-filters/link-filters-bar";
import { BioLinkDestination } from "@/components/bio/bio-link-destination";
import { decodeSelection } from "@/lib/bulk-selection";
import { serviceContext } from "@/server/context";
import { linksViewQuery } from "@/server/link-list-query";
import { requestTime } from "@/server/time";

export default async function AddLinksToBioPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/bio">) {
  const { workspace } = await params,
    query = await searchParams;
  const ctx = await serviceContext(workspace),
    t = await getTranslations("bio.destination");
  const ids = decodeSelection(query.selection);
  const view = linksViewQuery(query, requestTime());
  const allowed = can(ctx.actor, "resource.update");
  const result =
    ids.length && allowed
      ? await pageBulkTagLinks(ctx, ids, { ...view.filter, page: view.page })
      : null;
  return (
    <Page
      crumbs={[
        { label: t("links"), href: `/${workspace}/links` },
        { label: t("title") },
      ]}
      title={t("title")}
      description={t("description")}
      width="form"
    >
      {result?.selected === ids.length && ids.length ? (
        <>
          <Section title={t("choosePage")}>
            <BioLinkDestination workspace={workspace} ids={ids} />
          </Section>
          <Section title={t("review")} description={t("reviewHint")}>
            <LinkFiltersBar
              ctx={ctx}
              workspace={workspace}
              filter={view.filter}
              counts={false}
            />
            <ul className="divide-y divide-line border-y border-line">
              {result.items.map((link) => (
                <li key={link.id} className="min-w-0 py-3">
                  <p className="truncate text-small font-medium">
                    {link.title || link.key}
                  </p>
                  <p className="truncate font-mono text-meta text-fg-muted">
                    {link.domain}/{link.key}
                  </p>
                  {link.tags.length ? (
                    <p className="truncate text-meta text-fg-muted">
                      {link.tags.map((tag) => tag.name).join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {!result.items.length ? (
              <p className="py-3 text-small text-fg-muted">{t("noResults")}</p>
            ) : null}
            <Pagination
              page={result.page}
              pages={result.pages}
              params={query}
            />
          </Section>
        </>
      ) : (
        <Notice tone="warning">
          {t(allowed ? "errors.link_not_found" : "errors.forbidden")}
        </Notice>
      )}
    </Page>
  );
}
