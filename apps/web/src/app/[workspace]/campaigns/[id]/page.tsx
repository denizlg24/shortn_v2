import { timeseries, totals } from "@shortn/core";
import { can } from "@shortn/core/authz";
import { buttonVariants, TimeSeriesChart } from "@shortn/ui";
import { ObjectId } from "mongodb";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CampaignsGate } from "@/components/campaigns/campaigns-gate";
import { taggedUrl } from "@/components/campaigns/utm-url";
import { CopyButton } from "@/components/page/copy-button";
import { Notice } from "@/components/page/notice";
import { Page, Section } from "@/components/page/page";
import {
  campaignsAccess,
  campaignTabs,
  loadCampaign,
} from "@/server/campaign-page";
import { lastDays } from "@/server/time";

const variantFields = ["source", "medium", "term", "content"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[workspace]/campaigns/[id]">) {
  const { workspace, id } = await params;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return {};
  const { campaign } = await loadCampaign(workspace, id);
  return { title: campaign.title };
}

export default async function CampaignOverviewPage({
  params,
  searchParams,
}: PageProps<"/[workspace]/campaigns/[id]">) {
  const { workspace, id } = await params;
  const { created, saved, variant, variants, skipped } = await searchParams;
  const access = await campaignsAccess(workspace);
  if (!access.allowed) return <CampaignsGate plan={access.plan} />;
  const t = await getTranslations("campaigns");
  const format = await getFormatter();
  const { ctx, campaign, links } = await loadCampaign(workspace, id);
  const base = `/${workspace}/campaigns/${id}`;
  const editable = can(ctx.actor, "resource.update");

  // Legacy counts a campaign's clicks by utm_campaign = its title.
  const scope = {
    workspaceId: ctx.workspace._id,
    linkIds: links.map((link) => new ObjectId(link.id)),
  };
  const range = { ...lastDays(30), timezone: "UTC" };
  const filters = { utmCampaign: campaign.title };
  const [stats, series] = links.length
    ? await Promise.all([
        totals(ctx.db, scope, range, filters),
        timeseries(ctx.db, scope, range, "day", filters),
      ])
    : [{ clicks: 0, scans: 0, uniques: 0 }, []];
  const savedOn = links.find((link) => link.id === variant);

  const detail = (label: string, value: ReactNode) => (
    <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-small break-words">{value}</dd>
    </div>
  );
  const defaults = (values: string[]) =>
    values.length ? values.join(", ") : t("overview.none");

  return (
    <Page
      crumbs={[
        { label: t("list.title"), href: `/${workspace}/campaigns` },
        { label: campaign.title },
      ]}
      title={campaign.title}
      description={campaign.description ?? undefined}
      actions={
        <>
          <CopyButton
            value={campaign.title}
            label={t("overview.copyParam")}
            copiedLabel={t("overview.copied")}
          />
          <Link
            href={`${base}/builder`}
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("overview.build")}
          </Link>
        </>
      }
      tabs={campaignTabs(workspace, id, editable, (key) => t(`tabs.${key}`))}
      tabsLabel={t("tabs.label")}
    >
      {created ? <Notice tone="success">{t("overview.created")}</Notice> : null}
      {saved ? <Notice tone="success">{t("overview.saved")}</Notice> : null}
      {typeof variants === "string" && /^\d{1,3}$/.test(variants) ? (
        <Notice tone="success">
          {t("overview.variantsSaved", {
            count: Number(variants),
            skipped:
              typeof skipped === "string" && /^\d{1,3}$/.test(skipped)
                ? Number(skipped)
                : 0,
          })}
        </Notice>
      ) : null}
      {savedOn ? (
        <Notice tone="success">
          {t("overview.variantSaved", {
            link: `${savedOn.domain}/${savedOn.key}`,
          })}
        </Notice>
      ) : null}

      <Section
        title={t("overview.last30")}
        aside={
          <Link
            href={`${base}/analytics`}
            className="text-small text-signal hover:underline"
          >
            {t("overview.seeAll")}
          </Link>
        }
      >
        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
          {(
            [
              [t("overview.clicks"), stats.clicks],
              [t("overview.scans"), stats.scans],
              [t("overview.visitors"), stats.uniques],
              [t("overview.links"), links.length],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="py-3 pr-4">
              <dt className="text-meta text-fg-muted">{label}</dt>
              <dd className="mt-1 font-mono text-section tabular-nums">
                {format.number(value)}
              </dd>
            </div>
          ))}
        </dl>
        {series.length ? (
          <TimeSeriesChart
            data={series.map((point) => ({
              date: point.t,
              value: point.clicks + point.scans,
            }))}
            seriesLabel={t("overview.visits")}
            interval="day"
            height={200}
            className="mt-6"
          />
        ) : (
          <p className="mt-4 text-small text-fg-muted">
            {t("overview.noData")}
          </p>
        )}
      </Section>

      <Section
        title={t("overview.linksTitle")}
        description={t("overview.linksHint")}
      >
        {links.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-small text-fg-muted">{t("overview.noLinks")}</p>
            <Link
              href={`${base}/builder`}
              className={buttonVariants({ variant: "secondary", size: "md" })}
            >
              {t("overview.build")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {links.map((link) => {
              const variants = link.utm.filter(
                (item) => item.campaign === campaign.title,
              );
              return (
                <li key={link.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link
                      href={`/${workspace}/links/${link.id}`}
                      className="font-mono text-small font-medium hover:underline"
                    >
                      <span className="text-fg-muted">{link.domain}/</span>
                      {link.key}
                    </Link>
                    <span className="font-mono text-small text-fg-muted tabular-nums">
                      {t("overview.linkClicks", {
                        count: link.clicks,
                        formatted: format.number(link.clicks),
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-small text-fg-muted">
                    {link.url}
                  </p>
                  {variants.length ? (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-small">
                        <thead className="text-left text-meta text-fg-muted">
                          <tr>
                            {variantFields.map((field) => (
                              <th
                                key={field}
                                scope="col"
                                className="py-1.5 pr-4 font-medium"
                              >
                                {t(`builder.fields.${field}`)}
                              </th>
                            ))}
                            <th scope="col" className="py-1.5 font-medium">
                              <span className="sr-only">
                                {t("overview.taggedUrl")}
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {variants.map((item, index) => (
                            <tr key={index}>
                              {variantFields.map((field) => (
                                <td key={field} className="py-2 pr-4">
                                  {item[field] ?? (
                                    <span className="text-fg-subtle">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="py-2 text-right">
                                <CopyButton
                                  value={taggedUrl(link, campaign.title, {
                                    source: item.source ?? "",
                                    medium: item.medium ?? "",
                                    term: item.term ?? "",
                                    content: item.content ?? "",
                                  })}
                                  label={t("overview.copyUrl")}
                                  copiedLabel={t("overview.copied")}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t("overview.details")}>
        <dl className="divide-y divide-line border-y border-line">
          {detail(
            t("overview.param"),
            <code className="font-mono">{campaign.title}</code>,
          )}
          {detail(
            t("overview.createdAt"),
            format.dateTime(new Date(campaign.createdAt), {
              dateStyle: "long",
            }),
          )}
          {detail(
            t("defaults.lists.sources"),
            defaults(campaign.utmDefaults.sources),
          )}
          {detail(
            t("defaults.lists.mediums"),
            defaults(campaign.utmDefaults.mediums),
          )}
          {detail(
            t("defaults.lists.terms"),
            defaults(campaign.utmDefaults.terms),
          )}
          {detail(
            t("defaults.lists.contents"),
            defaults(campaign.utmDefaults.contents),
          )}
        </dl>
      </Section>

      {can(ctx.actor, "resource.delete", {
        createdBy: campaign.createdBy ?? undefined,
      }) ? (
        <Section
          title={t("overview.delete")}
          description={t("overview.deleteHint")}
        >
          <Link
            href={`${base}/delete`}
            className={buttonVariants({ variant: "dangerGhost", size: "md" })}
          >
            {t("overview.delete")}
          </Link>
        </Section>
      ) : null}
    </Page>
  );
}
