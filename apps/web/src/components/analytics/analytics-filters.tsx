"use client";

import type { Dimension } from "@shortn/core";
import { useTranslations } from "next-intl";
import {
  FilterBar,
  FilterCombobox,
  FilterDate,
  FilterGroup,
  FilterLink,
  FilterSelect,
} from "@/components/page/filters";
import { useIntlLocale } from "@/lib/intl-locale";
import {
  allowedIntervals,
  eventKinds,
  filterDimensions,
  normalizeSearch,
  parseDay,
  rangePresets,
  spanDays,
  type AnalyticsQuery,
  type FilterDimension,
  type QueryFilter,
} from "./query";
import type { AnalyticsScope } from "./use-analytics";

export interface LinkOption {
  value: string;
  label: string;
}

// A campaign is already its utm_campaign; a QR code is one link's scans,
// and its own URL carries no UTM tags.
const hiddenFilters: Record<AnalyticsScope["type"], readonly QueryFilter[]> = {
  workspace: [],
  link: ["link"],
  campaign: ["utmCampaign"],
  qr: ["link", "kind", "utmSource", "utmMedium", "utmCampaign"],
};

export const shownFilters = (scope: AnalyticsScope["type"]) =>
  filterDimensions.filter(
    (dimension) => !hiddenFilters[scope].includes(dimension),
  );

const clip = (label: string) =>
  label.length > 48 ? `${label.slice(0, 47)}…` : label;

/**
 * 17 §Analytics: date range, interval and every filter as labelled controls,
 * all in the URL. Attribute filters need analyticsBreakdowns; without it the
 * bar keeps the range, interval, link and type, and the page explains once.
 */
export function AnalyticsFilters({
  workspace,
  scope,
  query,
  links,
  options,
  linkLabels,
  filterable,
  valueLabel,
  extra,
}: {
  workspace: string;
  scope: AnalyticsScope["type"];
  query: AnalyticsQuery;
  /** The workspace's links; the Link filter shows only when given. */
  links?: LinkOption[] | undefined;
  /** Values seen in the range, per dimension. */
  options: Partial<Record<Dimension, string[]>>;
  linkLabels: Record<string, string>;
  filterable: boolean;
  valueLabel: (dimension: Dimension, value: string) => string;
  /** Params the page owns (e.g. table sort), kept across filter changes. */
  extra?: Record<string, string>;
}) {
  const t = useTranslations("analytics");
  const groups = useTranslations("page.filters.groups");
  const intlLocale = useIntlLocale();
  const hidden = hiddenFilters[scope];
  const dimensions: FilterDimension[] = filterable ? shownFilters(scope) : [];
  const days = spanDays(query.range, query.from, query.to);

  const linkChoices = (() => {
    if (!links || hidden.includes("link")) return null;
    const active = query.filters.link;
    if (!active || links.some((link) => link.value === active)) return links;
    const known = linkLabels[active];
    return [
      { value: active, label: known ? `/${known}` : t("values.selectedLink") },
      ...links,
    ];
  })();

  const choicesFor = (dimension: FilterDimension) => {
    const values = [...(options[dimension] ?? [])];
    const active = query.filters[dimension];
    if (active && !values.includes(active)) values.unshift(active);
    return values.map((value) => ({
      value,
      label: clip(valueLabel(dimension, value)),
    }));
  };

  const rangeSummary = () => {
    if (query.range === "30d") return null;
    if (query.range !== "custom") return t(`rangeLabels.${query.range}`);
    const start = parseDay(query.from);
    const end = parseDay(query.to);
    return start && end
      ? new Intl.DateTimeFormat(intlLocale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).formatRange(start, end)
      : null;
  };

  const linkFilter = query.filters.link;
  const kindFilter = query.filters.kind;
  const applied = [
    rangeSummary(),
    linkFilter && !hidden.includes("link")
      ? `${t("filters.link")}: ${valueLabel("link", linkFilter)}`
      : null,
    kindFilter && !hidden.includes("kind")
      ? `${t("filters.kind")}: ${t(`kinds.${kindFilter === "scan" ? "scan" : "click"}`)}`
      : null,
    ...dimensions.map((dimension) => {
      const value = query.filters[dimension];
      return value
        ? `${t(`filters.${dimension}`)}: ${valueLabel(dimension, value)}`
        : null;
    }),
  ].filter((item): item is string => Boolean(item));

  return (
    <FilterBar
      clearParams={extra}
      applied={applied}
      normalize={(next, current) => normalizeSearch(next, current, new Date())}
    >
      <FilterGroup label={groups("period")}>
        <FilterSelect
          label={t("range")}
          name="range"
          value={query.range}
          options={[
            ...rangePresets.map((preset) => ({
              value: preset,
              label: t(`rangeLabels.${preset}`),
            })),
            { value: "custom", label: t("customRange") },
          ]}
        />
        {query.range === "custom" ? (
          <>
            <FilterDate label={t("from")} name="from" />
            <FilterDate label={t("to")} name="to" />
          </>
        ) : null}
        <FilterSelect
          label={t("interval")}
          name="interval"
          value={query.interval}
          options={allowedIntervals(days).map((interval) => ({
            value: interval,
            label: t(`intervals.${interval}`),
          }))}
        />
      </FilterGroup>
      <FilterGroup label={groups("activity")}>
        {linkChoices ? (
          <FilterLink
            workspace={workspace}
            label={t("filters.link")}
            allLabel={t("allLinks")}
            options={linkChoices.map((link) => ({
              value: link.value,
              label: clip(link.label),
            }))}
          />
        ) : null}
        {hidden.includes("kind") ? null : (
          <FilterSelect
            label={t("filters.kind")}
            name="kind"
            allLabel={t("kinds.all")}
            options={eventKinds.map((kind) => ({
              value: kind,
              label: t(`kinds.${kind}`),
            }))}
          />
        )}
      </FilterGroup>
      {(
        [
          ["location", ["country", "city"]],
          ["technology", ["device", "browser", "os"]],
          [
            "attribution",
            ["branch", "referrer", "utmSource", "utmMedium", "utmCampaign"],
          ],
        ] as const
      ).map(([group, members]) => {
        const visible = dimensions.filter((dimension) =>
          (members as readonly string[]).includes(dimension),
        );
        return visible.length ? (
          <FilterGroup key={group} label={groups(group)}>
            {visible.map((dimension) => (
              <FilterCombobox
                key={dimension}
                label={t(`filters.${dimension}`)}
                name={dimension}
                allLabel={t("any")}
                options={choicesFor(dimension)}
              />
            ))}
          </FilterGroup>
        ) : null;
      })}
      {Object.entries(extra ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </FilterBar>
  );
}
