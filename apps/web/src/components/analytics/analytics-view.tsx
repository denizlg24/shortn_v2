"use client";

import type { PlanId } from "@shortn/billing";
import {
  Button,
  cn,
  EmptyState,
  formatDate,
  formatNumber,
  Skeleton,
  StatStrip,
  TimeSeriesChart,
  type Stat,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, useMemo, type ReactNode } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import type { AnalyticsResult } from "@/server/actions/analytics";
import { tourAnchor } from "@/lib/tour/anchors";
import { GateNote, UpgradeLink } from "../plan-gate";
import { PageHeader } from "../shell/page-header";
import {
  AnalyticsFilters,
  shownFilters,
  type LinkOption,
} from "./analytics-filters";
import { TopTable } from "./breakdown-table";
import {
  breakdownOrder,
  breakdownSlugs,
  filterFor,
  isOpenBreakdown,
  toggledFilter,
  type BreakdownDimension,
  type BreakdownSlug,
} from "./breakdowns";
import { ExportButton } from "./export-button";
import { useValueLabel } from "./labels";
import { parseQuery, queryString } from "./query";
import { StatStripSkeleton } from "./skeleton";
import {
  useAnalytics,
  type AnalyticsRequest,
  type AnalyticsScope,
} from "./use-analytics";

export type { LinkOption } from "./analytics-filters";

const topRows = 10;

// Tables a scope can't vary on: a link has one link, a QR code's URL has
// no UTM tags, a campaign is a single utm_campaign.
const hiddenTables: Record<AnalyticsScope["type"], readonly BreakdownSlug[]> = {
  workspace: [],
  link: ["links"],
  qr: ["links", "utm-source", "utm-medium", "utm-campaign"],
  campaign: ["utm-campaign"],
};

const delta = (current: number, previous: number) =>
  previous > 0 ? current / previous - 1 : undefined;

export function AnalyticsView({
  workspace,
  scope,
  title,
  summary,
  breakdownGate,
  embedded = false,
  csvExport,
  links,
}: {
  workspace: string;
  scope: AnalyticsScope;
  /** The page title, or the section's accessible name when embedded. */
  title: ReactNode;
  /** Rendered between the filters and the numbers, e.g. the link's details. */
  summary?: ReactNode;
  /** Plan that unlocks breakdowns and filters; null when the plan has them. */
  breakdownGate: PlanId | null;
  /** Inside a `Page` that owns the heading and the gutters. */
  embedded?: boolean;
  /** Adds export review for raw events or aggregates in the selected view. */
  csvExport?: { params: Record<string, string>; gate: PlanId | null };
  /** The workspace's links for the Link filter (server-loaded). */
  links?: LinkOption[];
}) {
  const t = useTranslations("analytics");
  const tGate = useTranslations("gate");
  const intlLocale = useIntlLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chartHeadingId = useId();
  const gateHeadingId = useId();
  const gateNoteId = useId();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const filterable = breakdownGate === null;
  const scopeType = scope.type;
  const scopeId = scope.type === "workspace" ? null : scope.id;

  const slugs = useMemo(
    () =>
      breakdownOrder.filter(
        (slug) =>
          !hiddenTables[scopeType].includes(slug) &&
          (filterable || isOpenBreakdown(breakdownSlugs[slug])),
      ),
    [scopeType, filterable],
  );
  const request = useMemo<AnalyticsRequest>(
    () => ({
      scope:
        scopeType === "workspace" || scopeId === null
          ? { type: "workspace" }
          : { type: scopeType, id: scopeId },
      query,
      dimensions: slugs.map((slug) => breakdownSlugs[slug]),
      limit: topRows,
      options: filterable ? [...shownFilters(scopeType)] : [],
    }),
    [scopeType, scopeId, query, slugs, filterable],
  );
  const { status, data, retry } = useAnalytics(workspace, request);
  const valueLabel = useValueLabel(data?.linkLabels);
  const firstLoad = data === null && status === "loading";

  const rowHref = (dimension: BreakdownDimension) => (value: string) => {
    const next = toggledFilter(query, dimension, value);
    return next ? `${pathname}${queryString(next)}` : null;
  };
  const seeAllHref = (slug: BreakdownSlug) =>
    data
      ? `/${workspace}/analytics/${slug}${queryString(query, data.scopeFilters)}`
      : null;

  const exportGated = csvExport?.gate ?? null;
  // Without breakdowns, the gate section below already names CSV export, so
  // the disabled button points there instead of repeating the note.
  const exportControl = csvExport ? (
    <ExportButton
      workspace={workspace}
      query={query}
      params={csvExport.params}
      gate={exportGated}
      {...(!filterable && exportGated ? { describedBy: gateNoteId } : {})}
    />
  ) : null;

  const body = (
    <>
      <AnalyticsFilters
        workspace={workspace}
        scope={scopeType}
        query={query}
        links={links}
        options={data?.options ?? {}}
        linkLabels={data?.linkLabels ?? {}}
        filterable={filterable}
        valueLabel={valueLabel}
      />
      {summary}
      {status === "error" && data === null ? (
        <EmptyState
          tone="danger"
          title={t("error.title")}
          description={t("error.body")}
          action={<Button onClick={retry}>{t("error.retry")}</Button>}
        />
      ) : (
        <div
          aria-busy={status === "loading" || undefined}
          className={cn(
            "flex flex-col gap-8 transition-opacity duration-(--motion-fast)",
            status === "loading" && data !== null && "opacity-60",
          )}
        >
          {status === "error" ? (
            <p
              role="alert"
              className="-mb-4 flex items-center gap-2 text-small text-danger"
            >
              {t("error.refresh")}
              <Button variant="ghost" size="sm" onClick={retry}>
                {t("error.retry")}
              </Button>
            </p>
          ) : null}
          {data?.range.clampedFrom ? (
            <GateNote className="-mb-2">
              {t("clamped", {
                date: formatDate(new Date(data.range.clampedFrom), intlLocale),
              })}{" "}
              <UpgradeLink />
            </GateNote>
          ) : null}

          {data ? (
            <StatStrip
              stats={statsFor(data, {
                labels: {
                  clicks: t("stats.clicks"),
                  scans: t("stats.scans"),
                  uniques: t("stats.uniques"),
                  topCountry: t("stats.topCountry"),
                },
                topCountry: filterable
                  ? data.breakdowns.country?.[0]
                    ? valueLabel("country", data.breakdowns.country[0].value)
                    : "—"
                  : null,
                scansOnly: scopeType === "qr",
                intlLocale,
              })}
            />
          ) : (
            <StatStripSkeleton
              count={(scopeType === "qr" ? 2 : 3) + (filterable ? 1 : 0)}
            />
          )}

          <section
            aria-labelledby={chartHeadingId}
            className="min-w-0"
            {...tourAnchor("analytics-chart")}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id={chartHeadingId} className="text-small font-medium">
                {t("series")}
              </h2>
              {exportControl}
            </div>
            {firstLoad || !data ? (
              <Skeleton className="h-60 w-full rounded-control" />
            ) : data.totals.clicks + data.totals.scans === 0 ? (
              <p className="grid h-60 place-items-center border-y border-line text-center text-small text-fg-muted">
                {t("noActivity")}
              </p>
            ) : (
              <TimeSeriesChart
                data={data.series.map((point) => ({
                  date: point.t,
                  value: point.clicks + point.scans,
                }))}
                seriesLabel={t("series")}
                interval={query.interval}
                height={240}
              />
            )}
          </section>

          {slugs.length ? (
            <div
              className="grid gap-x-10 gap-y-8 md:grid-cols-2"
              {...(breakdownGate ? {} : tourAnchor("analytics-breakdowns"))}
            >
              {slugs.map((slug) => {
                const dimension = breakdownSlugs[slug];
                const filter = filterFor(dimension);
                return (
                  <div
                    key={slug}
                    className={cn(slug === "links" && "md:col-span-2")}
                  >
                    <TopTable
                      title={t(`breakdowns.${slug}.title`)}
                      rows={data?.breakdowns[dimension]?.map((row) => ({
                        ...row,
                        label: valueLabel(dimension, row.value),
                      }))}
                      loading={firstLoad}
                      seeAllHref={seeAllHref(slug)}
                      rowHref={rowHref(dimension)}
                      active={filter ? query.filters[filter] : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {breakdownGate ? (
            <section
              aria-labelledby={gateHeadingId}
              className="border-t border-line pt-5"
              {...tourAnchor("analytics-breakdowns")}
            >
              <h2 id={gateHeadingId} className="mb-2 text-small font-medium">
                {t("gated.title")}
              </h2>
              <GateNote id={gateNoteId}>
                {t(
                  csvExport && exportGated ? "gated.withExport" : "gated.body",
                  { plan: tGate(`plans.${breakdownGate}`) },
                )}{" "}
                <UpgradeLink />
              </GateNote>
            </section>
          ) : null}
        </div>
      )}
    </>
  );

  return embedded ? (
    <div>
      <h2 className="sr-only">{title}</h2>
      {body}
    </div>
  ) : (
    <>
      <PageHeader title={title} />
      <div className="px-gutter pt-6 pb-10">{body}</div>
    </>
  );
}

function statsFor(
  data: AnalyticsResult,
  {
    labels,
    topCountry,
    scansOnly,
    intlLocale,
  }: {
    labels: Record<"clicks" | "scans" | "uniques" | "topCountry", string>;
    /** Null when the plan has no country breakdown. */
    topCountry: string | null;
    /** A QR scope counts scans only, so a clicks figure would always read 0. */
    scansOnly: boolean;
    intlLocale: string;
  },
): Stat[] {
  const number = (key: "clicks" | "scans" | "uniques"): Stat => {
    const change = delta(data.totals[key], data.previous[key]);
    return {
      label: labels[key],
      value: formatNumber(data.totals[key], intlLocale),
      ...(change === undefined ? {} : { delta: change }),
    };
  };
  return [
    ...(scansOnly ? [] : [number("clicks")]),
    number("scans"),
    number("uniques"),
    ...(topCountry === null
      ? []
      : [{ label: labels.topCountry, value: topCountry }]),
  ];
}
