"use client";

import type { PlanId } from "@shortn/billing";
import type { Dimension } from "@shortn/core";
import {
  Button,
  cn,
  EmptyState,
  FilterBar,
  formatDate,
  formatNumber,
  Skeleton,
  StatStrip,
  TimeSeriesChart,
  type FilterField,
  type FilterValue,
  type Stat,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo, type ReactNode } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import type { AnalyticsResult } from "@/server/actions/analytics";
import { GateNote, UpgradeLink } from "../plan-gate";
import { PageHeader } from "../shell/page-header";
import { BreakdownPanel } from "./breakdown-panel";
import { ExportButton } from "./export-button";
import { useValueLabel } from "./labels";
import {
  allowedIntervals,
  filterDimensions,
  intervals,
  parseQuery,
  queryParamNames,
  spanDays,
  toSearchParams,
  type AnalyticsFilters,
  type AnalyticsQuery,
  type FilterDimension,
} from "./query";
import { RangePicker } from "./range-picker";
import { Segmented } from "./segmented";
import { StatStripSkeleton } from "./skeleton";
import {
  useAnalytics,
  type AnalyticsRequest,
  type AnalyticsScope,
} from "./use-analytics";

const linkDimension = ["link"] as const satisfies readonly Dimension[];

// A campaign scope is already filtered to its utm_campaign, and QR scans
// arrive through the code's own URL, which carries no UTM tags.
const hiddenDimensions: Record<
  AnalyticsScope["type"],
  readonly FilterDimension[]
> = {
  workspace: [],
  link: [],
  campaign: ["utmCampaign"],
  qr: ["utmSource", "utmMedium", "utmCampaign"],
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
}: {
  workspace: string;
  scope: AnalyticsScope;
  /** The page title, or the section's accessible name when embedded. */
  title: ReactNode;
  /** Rendered between the header and the numbers, e.g. the link's details. */
  summary?: ReactNode;
  /** Plan that unlocks breakdowns and filters; null when the plan has them. */
  breakdownGate: PlanId | null;
  /** Inside a page that owns the header (a tab): controls sit in a toolbar row. */
  embedded?: boolean;
  /** Adds an export of the raw events for the selected range. */
  csvExport?: { params: Record<string, string>; gate: PlanId | null };
}) {
  const t = useTranslations("analytics");
  const tGate = useTranslations("gate");
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chartHeadingId = useId();

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const setQuery = useCallback(
    (next: AnalyticsQuery) => {
      const params = toSearchParams(next);
      for (const [name, value] of new URLSearchParams(window.location.search))
        if (!queryParamNames.has(name)) params.append(name, value);
      const search = params.toString();
      window.history.pushState(
        null,
        "",
        search ? `${pathname}?${search}` : pathname,
      );
    },
    [pathname],
  );

  const scopeType = scope.type;
  const scopeId = scope.type === "workspace" ? null : scope.id;
  const dimensions = useMemo(
    () =>
      filterDimensions.filter(
        (dimension) => !hiddenDimensions[scopeType].includes(dimension),
      ),
    [scopeType],
  );
  const request = useMemo<AnalyticsRequest>(
    () => ({
      scope:
        scopeType === "workspace" || scopeId === null
          ? { type: "workspace" }
          : { type: scopeType, id: scopeId },
      query,
      dimensions:
        scopeType === "workspace"
          ? [...dimensions, ...linkDimension]
          : [...dimensions],
    }),
    [scopeType, scopeId, dimensions, query],
  );
  const { status, data, retry } = useAnalytics(workspace, request);
  const valueLabel = useValueLabel(data?.linkLabels);
  const firstLoad = data === null && status === "loading";
  const filterable = breakdownGate === null;

  const setFilter = (dimension: Dimension, value: string | null) => {
    const filters: AnalyticsFilters = { ...query.filters };
    const key = filterDimensions.find((option) => option === dimension);
    if (!key) return;
    if (value === null || filters[key] === value) delete filters[key];
    else filters[key] = value;
    setQuery({ ...query, filters });
  };

  const filterFields: FilterField[] = dimensions.map((dimension) => {
    const values = (data?.breakdowns[dimension] ?? []).map((row) => row.value);
    const active = query.filters[dimension];
    if (active && !values.includes(active)) values.unshift(active);
    return {
      id: dimension,
      label: t(`filters.${dimension}`),
      options: values.map((value) => ({
        value,
        label: valueLabel(dimension, value),
      })),
    };
  });
  const filterValue: FilterValue = Object.fromEntries(
    Object.entries(query.filters).map(([dimension, value]) => [
      dimension,
      [value],
    ]),
  );

  const days = spanDays(query.range, query.from, query.to);
  const allowed = allowedIntervals(days);

  const controls = (
    <>
      {filterable ? (
        <FilterBar
          fields={filterFields}
          value={filterValue}
          onValueChange={(next) => {
            const filters: AnalyticsFilters = {};
            for (const dimension of dimensions) {
              const value = next[dimension]?.at(-1);
              if (value) filters[dimension] = value;
            }
            setQuery({ ...query, filters });
          }}
          pickerPlaceholder={t("filterBy")}
          className="max-md:order-last max-md:w-full"
        />
      ) : null}
      <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:ml-0 max-sm:w-full">
        <RangePicker
          query={query}
          onChange={setQuery}
          className="max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
        />
        {csvExport ? (
          <ExportButton
            workspace={workspace}
            query={query}
            params={csvExport.params}
            gate={csvExport.gate}
          />
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="flex flex-wrap items-center gap-3 gap-y-2 px-gutter pt-5">
          <h2 className="sr-only">{title}</h2>
          {controls}
        </div>
      ) : (
        <PageHeader title={title} className="flex-wrap gap-y-2 py-2.5">
          {controls}
        </PageHeader>
      )}
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
            "flex flex-col gap-8 px-gutter pt-6 pb-10 transition-opacity duration-(--motion-fast)",
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
                topCountry: data.breakdowns.country?.[0]
                  ? valueLabel("country", data.breakdowns.country[0].value)
                  : null,
                countryLocked:
                  breakdownGate && data.gated.includes("country")
                    ? t("lockedStat", {
                        plan: tGate(`plans.${breakdownGate}`),
                      })
                    : null,
                scansOnly: scopeType === "qr",
                intlLocale,
              })}
            />
          ) : (
            <StatStripSkeleton count={scopeType === "qr" ? 3 : 4} />
          )}

          <section aria-labelledby={chartHeadingId} className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id={chartHeadingId} className="text-small font-medium">
                {t("series")}
              </h2>
              <Segmented
                label={t("interval")}
                options={intervals.map((interval) => ({
                  value: interval,
                  label: t(`intervals.${interval}`),
                  disabled: !allowed.includes(interval),
                  disabledReason: t("intervalUnavailable"),
                }))}
                value={query.interval}
                onValueChange={(interval) => setQuery({ ...query, interval })}
              />
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

          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {scope.type === "workspace" ? (
              <BreakdownPanel
                dimension="link"
                title={t("dimensions.link")}
                rows={data?.breakdowns.link}
                loading={firstLoad}
                gate={null}
                valueLabel={valueLabel}
                onSelect={(id) =>
                  router.push(`/${workspace}/links/${id}` as const)
                }
                className="border-t border-line pt-5 md:col-span-2"
              />
            ) : null}
            {dimensions.map((dimension) => (
              <BreakdownPanel
                key={dimension}
                dimension={dimension}
                title={t(`dimensions.${dimension}`)}
                rows={data?.breakdowns[dimension]}
                loading={firstLoad}
                gate={
                  breakdownGate &&
                  (data === null || data.gated.includes(dimension))
                    ? breakdownGate
                    : null
                }
                valueLabel={valueLabel}
                onSelect={(value) => setFilter(dimension, value)}
                className="border-t border-line pt-5"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function statsFor(
  data: AnalyticsResult,
  {
    labels,
    topCountry,
    countryLocked,
    scansOnly,
    intlLocale,
  }: {
    labels: Record<"clicks" | "scans" | "uniques" | "topCountry", string>;
    topCountry: string | null;
    countryLocked: string | null;
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
    {
      label: labels.topCountry,
      value: topCountry ?? "—",
      ...(countryLocked ? { detail: countryLocked } : {}),
    },
  ];
}
