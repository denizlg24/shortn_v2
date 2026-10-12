# apps/web/src/components/analytics/analytics-filters.tsx

- LinkOption · interface · L28-L31 — interface LinkOption
- shownFilters · function · L42-L45 — shownFilters = (scope: AnalyticsScope["type"])
- clip · function · L47-L48 — clip = (label: string)
- AnalyticsFilters · function · L55-L230 — function AnalyticsFilters({ workspace, scope, query, links, options, linkLabels, filterable, valueLabel, extra, }: { workspace: string; scope: AnalyticsScope["type"]; query: AnalyticsQuery; /** The workspace's links; the Link filter shows only when given. */ links?: LinkOption[] | undefined; /** Values seen in the range, per dimension. */ options: Partial<Record<Dimension, string[]>>; linkLabels: Record<string, string>; filterable: boolean; valueLabel: (dimension: Dimension, value: string) => string; /** Params the page owns (e.g. table sort), kept across filter changes. */ extra?: Record<string, string>; })
- choicesFor · function · L97-L105 — choicesFor = (dimension: FilterDimension)
- rangeSummary · function · L107-L119 — rangeSummary = ()
