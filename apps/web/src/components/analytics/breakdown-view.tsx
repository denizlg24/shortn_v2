"use client";

import type { PlanId } from "@shortn/billing";
import { Button, cn, EmptyState, formatDate, Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { GateNote, UpgradeLink } from "../plan-gate";
import {
  AnalyticsFilters,
  shownFilters,
  type LinkOption,
} from "./analytics-filters";
import { FullTable } from "./breakdown-table";
import {
  breakdownSlugs,
  isOpenBreakdown,
  nextSort,
  parseSort,
  sortParams,
  sortRows,
  filterFor,
  type BreakdownSlug,
} from "./breakdowns";
import { ExportButton } from "./export-button";
import { useValueLabel } from "./labels";
import { parseQuery, queryString } from "./query";
import {
  useAnalytics,
  type AnalyticsRequest,
  type AnalyticsScope,
} from "./use-analytics";

// Enough for every country, device or campaign; cities and links stop here.
const rowLimit = 1000;

/** /analytics/{dimension}: the whole breakdown as one sortable table. */
export function BreakdownView({
  workspace,
  scope,
  slug,
  links,
  breakdownGate,
  csvGate,
}: {
  workspace: string;
  scope: AnalyticsScope;
  slug: BreakdownSlug;
  links: LinkOption[];
  breakdownGate: PlanId | null;
  csvGate: PlanId | null;
}) {
  const t = useTranslations("analytics");
  const tGate = useTranslations("gate");
  const intlLocale = useIntlLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dimension = breakdownSlugs[slug];
  const filterable = breakdownGate === null;
  const locked = !filterable && !isOpenBreakdown(dimension);

  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const sort = useMemo(
    () => parseSort(searchParams.get("sort"), searchParams.get("dir")),
    [searchParams],
  );
  const request = useMemo<AnalyticsRequest>(
    () => ({
      scope,
      query,
      dimensions: locked ? [] : [dimension],
      limit: rowLimit,
      options: filterable ? [...shownFilters(scope.type)] : [],
      totalsOnly: true,
    }),
    [scope, query, dimension, locked, filterable],
  );
  const { status, data, retry } = useAnalytics(workspace, request);
  const valueLabel = useValueLabel(data?.linkLabels);
  const collator = useMemo(() => new Intl.Collator(intlLocale), [intlLocale]);

  const rows = useMemo(
    () =>
      sortRows(
        (data?.breakdowns[dimension] ?? []).map((row) => ({
          ...row,
          label: valueLabel(dimension, row.value),
        })),
        sort,
        collator,
      ),
    [data, dimension, valueLabel, sort, collator],
  );
  const grandTotal = data ? data.totals.clicks + data.totals.scans : 0;
  const title = t(`breakdowns.${slug}.title`);
  const column = t(`breakdowns.${slug}.column`);

  const scopeParams: Record<string, string> =
    scope.type === "campaign" ? { campaign: scope.id } : {};
  const overviewHref =
    scope.type === "campaign"
      ? `/${workspace}/campaigns/${scope.id}/analytics`
      : `/${workspace}/analytics`;

  return (
    <>
      <AnalyticsFilters
        workspace={workspace}
        scope={scope.type}
        query={query}
        links={links}
        options={data?.options ?? {}}
        linkLabels={data?.linkLabels ?? {}}
        filterable={filterable}
        valueLabel={valueLabel}
        extra={{ ...scopeParams, ...sortParams(sort) }}
      />
      {locked && breakdownGate ? (
        <GateNote>
          {t(csvGate ? "gated.withExport" : "gated.body", {
            plan: tGate(`plans.${breakdownGate}`),
          })}{" "}
          <UpgradeLink />
        </GateNote>
      ) : status === "error" && data === null ? (
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
            "flex flex-col gap-4 transition-opacity duration-(--motion-fast)",
            status === "loading" && data !== null && "opacity-60",
          )}
        >
          {status === "error" ? (
            <p
              role="alert"
              className="flex items-center gap-2 text-small text-danger"
            >
              {t("error.refresh")}
              <Button variant="ghost" size="sm" onClick={retry}>
                {t("error.retry")}
              </Button>
            </p>
          ) : null}
          {data?.range.clampedFrom ? (
            <GateNote>
              {t("clamped", {
                date: formatDate(new Date(data.range.clampedFrom), intlLocale),
              })}{" "}
              <UpgradeLink />
            </GateNote>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-small text-fg-muted" aria-live="polite">
              {data
                ? rows.length >= rowLimit
                  ? t("table.capped", { count: rows.length })
                  : t("table.summary", {
                      count: rows.length,
                      total: grandTotal,
                    })
                : null}
            </p>
            <ExportButton
              workspace={workspace}
              query={query}
              params={scopeParams}
              gate={csvGate}
              dimension={dimension}
            />
          </div>
          {data === null ? (
            <div aria-hidden className="flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="border-y border-line py-6 text-center text-small text-fg-muted">
              {t("empty")}
            </p>
          ) : (
            <FullTable
              caption={title}
              nameLabel={column}
              rows={rows}
              grandTotal={grandTotal}
              sort={sort}
              sortHref={(next) =>
                `${pathname}${queryString(query, { ...scopeParams, ...sortParams(nextSort(sort, next)) })}`
              }
              rowHref={(value) => {
                const filter = filterFor(dimension);
                return filter
                  ? `${overviewHref}${queryString({
                      ...query,
                      filters: { ...query.filters, [filter]: value },
                    })}`
                  : null;
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
