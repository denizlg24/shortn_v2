"use client";

import type { PlanId } from "@shortn/billing";
import type { LinkView } from "@shortn/core";
import {
  BarList,
  Button,
  formatDate,
  formatNumber,
  Skeleton,
  StatStrip,
  TagChips,
  TimeSeriesChart,
} from "@shortn/ui";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useIntlLocale } from "@/lib/intl-locale";
import { StatStripSkeleton } from "../analytics/skeleton";
import { useValueLabel } from "../analytics/labels";
import { parseQuery } from "../analytics/query";
import {
  useAnalytics,
  type AnalyticsRequest,
} from "../analytics/use-analytics";
import { PlanGate } from "../plan-gate";
import { SafetyStatus } from "./safety-status";

const last30Days = parseQuery(new URLSearchParams());

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-small font-medium text-fg">{children}</h3>;
}

export function LinkOverview({
  workspace,
  link,
  breakdownGate,
}: {
  workspace: string;
  link: LinkView;
  breakdownGate: PlanId | null;
}) {
  const t = useTranslations("links.overview");
  const tAnalytics = useTranslations("analytics");
  const intlLocale = useIntlLocale();
  const valueLabel = useValueLabel();
  const request = useMemo<AnalyticsRequest>(
    () => ({
      scope: { type: "link", id: link.id },
      query: last30Days,
      dimensions: ["country", "referrer"],
    }),
    [link.id],
  );
  const { status, data, retry } = useAnalytics(workspace, request);
  const total = data ? data.totals.clicks + data.totals.scans : 0;
  const previous = data ? data.previous.clicks + data.previous.scans : 0;
  const topValue = (dimension: "country" | "referrer") => {
    const row = data?.breakdowns[dimension]?.[0];
    return row ? valueLabel(dimension, row.value) : "—";
  };
  const breakdownItems = (dimension: "country" | "referrer") =>
    (data?.breakdowns[dimension] ?? []).slice(0, 5).map((row) => ({
      id: row.value,
      label: valueLabel(dimension, row.value),
      value: row.clicks + row.scans,
    }));

  return (
    <div className="flex flex-col gap-7">
      {status === "error" ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-small text-danger"
        >
          {tAnalytics("error.title")}
          <Button variant="ghost" size="sm" onClick={retry}>
            {tAnalytics("error.retry")}
          </Button>
        </p>
      ) : null}
      {data ? (
        <StatStrip
          stats={[
            {
              label: t("clicks30"),
              value: formatNumber(total, intlLocale),
              ...(previous > 0 ? { delta: total / previous - 1 } : {}),
            },
            {
              label: t("allTime"),
              value: formatNumber(link.clicks, intlLocale),
            },
            {
              label: t("topCountry"),
              value: (
                <span className="text-body font-medium">
                  {topValue("country")}
                </span>
              ),
            },
            {
              label: t("topReferrer"),
              value: (
                <span className="text-body font-medium">
                  {topValue("referrer")}
                </span>
              ),
            },
          ]}
        />
      ) : (
        <StatStripSkeleton />
      )}
      <section aria-label={t("clicks30")}>
        {!data ? (
          <Skeleton className="h-44 w-full rounded-control" />
        ) : total === 0 ? (
          <p className="border-y border-line py-10 text-center text-small text-pretty text-fg-muted">
            {t("noData")}
          </p>
        ) : (
          <TimeSeriesChart
            data={data.series.map((point) => ({
              date: point.t,
              value: point.clicks + point.scans,
            }))}
            seriesLabel={tAnalytics("series")}
            height={176}
          />
        )}
      </section>
      {breakdownGate ? (
        <PlanGate
          feature="analyticsBreakdowns"
          plan={breakdownGate}
          className="border-t border-line pt-5"
        />
      ) : data && total > 0 ? (
        <div className="grid gap-x-8 gap-y-6 border-t border-line pt-5 sm:grid-cols-2">
          <section>
            <SectionHeading>{tAnalytics("dimensions.country")}</SectionHeading>
            <BarList
              label={tAnalytics("dimensions.country")}
              items={breakdownItems("country")}
            />
          </section>
          <section>
            <SectionHeading>{tAnalytics("dimensions.referrer")}</SectionHeading>
            <BarList
              label={tAnalytics("dimensions.referrer")}
              items={breakdownItems("referrer")}
            />
          </section>
        </div>
      ) : null}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5 border-t border-line pt-5 text-small">
        <dt className="text-fg-muted">{t("created")}</dt>
        <dd className="font-mono tabular-nums">
          {formatDate(new Date(link.createdAt), intlLocale, true)}
        </dd>
        {link.title ? (
          <>
            <dt className="text-fg-muted">{t("title")}</dt>
            <dd className="min-w-0 break-words">{link.title}</dd>
          </>
        ) : null}
        {link.description ? (
          <>
            <dt className="text-fg-muted">{t("description")}</dt>
            <dd className="min-w-0 break-words text-pretty">
              {link.description}
            </dd>
          </>
        ) : null}
        <dt className="text-fg-muted">{t("tags")}</dt>
        <dd className="min-w-0">
          {link.tags.length > 0 ? (
            <TagChips
              tags={link.tags.map((tag) => tag.name)}
              max={12}
              className="flex-wrap"
            />
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-fg-muted">{t("password")}</dt>
        <dd className="min-w-0 break-words">
          {link.password
            ? link.password.hint
              ? t("passwordHint", { hint: link.password.hint })
              : t("passwordOn")
            : t("passwordOff")}
        </dd>
        <dt className="text-fg-muted">{t("safety")}</dt>
        <dd>
          <SafetyStatus safety={link.safety} />
        </dd>
      </dl>
      <Link
        href={`/${workspace}/links/${link.id}` as const}
        className="inline-flex items-center gap-1 self-start text-small font-medium text-signal underline-offset-2 hover:underline"
      >
        {t("fullAnalytics")}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}
