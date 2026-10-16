import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, cursorTags, pageCampaigns, pageBulkTagLinks } from "@shortn/core";
import { buttonVariants } from "@shortn/ui";
import { Page, Section } from "@/components/page/page";
import { Notice } from "@/components/page/notice";
import { Pagination } from "@/components/page/pagination";
import { LinksFilters } from "@/components/link-pages/links-filters";
import { BulkCampaignForm } from "@/components/link-pages/bulk-campaign-form";
import { hasFeature, loadEntitlements } from "@shortn/billing";
import { serviceContext } from "@/server/context";
import {
  saveCampaignSelection,
  readCampaignSelection,
} from "@/server/bulk-link-campaign";
import { decodeSelection } from "@/lib/bulk-selection";
import { linksViewQuery } from "@/server/link-list-query";
import { requestTime } from "@/server/time";
export async function generateMetadata() {
  return { title: (await getTranslations("bulkCampaign"))("title") };
}
export default async function BulkCampaignPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/links/campaign">) {
  const { workspace } = await params,
    query = await searchParams,
    ctx = await serviceContext(workspace),
    t = await getTranslations("bulkCampaign"),
    base = `/${workspace}/links`;
  const entitled = hasFeature(
    await loadEntitlements(ctx.db, ctx.workspace._id),
    "campaigns",
  );
  const incoming = decodeSelection(query.selection);
  if (incoming.length && entitled && can(ctx.actor, "resource.update")) {
    const ref = await saveCampaignSelection(ctx, incoming);
    if (ref) redirect(`${base}/campaign?selectionRef=${ref}`);
  }
  const ids = await readCampaignSelection(ctx, query.selectionRef),
    ref = typeof query.selectionRef === "string" ? query.selectionRef : "";
  const view = linksViewQuery(query, requestTime());
  const [result, tags, campaigns] = await Promise.all([
    ids.length && entitled
      ? pageBulkTagLinks(ctx, ids, { ...view.filter, page: view.page })
      : null,
    can(ctx.actor, "resource.update") && entitled
      ? cursorTags(ctx, { limit: 50 })
      : null,
    can(ctx.actor, "resource.update") && entitled
      ? pageCampaigns(ctx, { limit: 25 })
      : null,
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
              !can(ctx.actor, "resource.update")
                ? "errors.forbidden"
                : !entitled
                  ? "errors.feature_required"
                  : "errors.not_found",
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
            <BulkCampaignForm
              workspace={workspace}
              selectionRef={ref}
              count={ids.length}
              initial={{
                items:
                  campaigns?.items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    linkCount: item.linkCount,
                  })) ?? [],
                total: campaigns?.total ?? 0,
                nextCursor: campaigns?.nextCursor ?? null,
              }}
            />
          </Section>
          <Section
            title={t("review")}
            description={t("reviewHelp", { count: ids.length })}
          >
            <LinksFilters
              workspace={workspace}
              tags={tags?.items.map((tag) => tag.name) ?? []}
              preserve={{ selectionRef: ref }}
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
