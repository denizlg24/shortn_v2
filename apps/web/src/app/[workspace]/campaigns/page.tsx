import { listCampaigns, type CampaignView } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { buttonVariants, cn } from "@shortn/ui";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { CampaignsFilters } from "@/components/campaigns/campaigns-filters";
import {
  isCampaignSort,
  type CampaignSort,
} from "@/components/campaigns/campaign-sorts";
import { Notice } from "@/components/page/notice";
import { Page } from "@/components/page/page";
import { Pagination } from "@/components/page/pagination";
import { campaignsAccess } from "@/server/campaign-page";
import { serviceContext } from "@/server/context";

const pageSize = 25;

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

const order: Record<
  CampaignSort,
  (a: CampaignView, b: CampaignView) => number
> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
  links: (a, b) => b.linkCount - a.linkCount,
  title: (a, b) => a.title.localeCompare(b.title),
};

export async function generateMetadata() {
  const t = await getTranslations("campaigns.list");
  return { title: t("title") };
}

export default async function CampaignsPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/campaigns">) {
  const { workspace } = await params;
  const query = await searchParams;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns.list");
  const format = await getFormatter();
  const ctx = await serviceContext(workspace);

  const search = one(query.q)?.trim().toLowerCase().slice(0, 200);
  const sort = one(query.sort);
  const all = await listCampaigns(ctx);
  const matching = (
    search
      ? all.filter(
          (campaign) =>
            campaign.title.toLowerCase().includes(search) ||
            campaign.description?.toLowerCase().includes(search),
        )
      : all
  ).sort(order[isCampaignSort(sort) ? sort : "newest"]);
  const pages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number(one(query.page)) || 1));
  const shown = matching.slice((page - 1) * pageSize, page * pageSize);

  const canCreate = can(ctx.actor, "resource.create");
  const base = `/${workspace}/campaigns`;
  const newButton = (className?: string) =>
    canCreate ? (
      <Link
        href={`${base}/new`}
        className={cn(
          buttonVariants({ variant: "primary", size: "lg" }),
          className,
        )}
      >
        {t("new")}
      </Link>
    ) : null;

  return (
    <Page
      crumbs={[{ label: t("title") }]}
      title={t("title")}
      description={t("count", { count: all.length })}
      actions={newButton()}
    >
      {one(query.deleted) ? (
        <Notice tone="success">{t("deleted")}</Notice>
      ) : null}
      <CampaignsFilters />

      {shown.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-body text-fg-muted">
            {search ? t("emptyFiltered") : t("empty")}
          </p>
          {search ? null : newButton("mt-4")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead className="border-b border-line text-left text-meta text-fg-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t("columns.campaign")}
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    {t("columns.links")}
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
                {shown.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-bg-subtle">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`${base}/${campaign.id}`}
                        className="font-medium text-fg hover:underline"
                      >
                        {campaign.title}
                      </Link>
                      {campaign.description ? (
                        <p className="truncate text-meta text-fg-muted md:max-w-xl">
                          {campaign.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                      {format.number(campaign.linkCount)}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap text-fg-muted max-sm:hidden">
                      {format.dateTime(new Date(campaign.createdAt), {
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
          <div className="mt-4 flex justify-end">
            <Pagination page={page} pages={pages} params={query} />
          </div>
        </>
      )}
    </Page>
  );
}
