# packages/ui/src/components/time-series-chart.tsx

- ChartTooltipProps · type · L18-L18 — type ChartTooltipProps = TooltipContentProps<TooltipValueType, string | number>;
- TimeSeriesPoint · interface · L20-L23 — interface TimeSeriesPoint
- TimeSeriesInterval · type · L25-L25 — type TimeSeriesInterval = "hour" | "day" | "week" | "month";
- TimeSeriesChartProps · interface · L27-L35 — interface TimeSeriesChartProps
- formatTick · function · L37-L53 — function formatTick( date: Date, interval: TimeSeriesInterval, intlLocale: string, )
- formatPointLabel · function · L55-L67 — function formatPointLabel( date: Date, interval: TimeSeriesInterval, intlLocale: string, )
- TimeSeriesChart · function · L75-L141 — function TimeSeriesChart({ data, seriesLabel, interval = "day", height = 168, className, }: TimeSeriesChartProps)
- ChartTooltip · function · L143-L174 — function ChartTooltip({ active, payload, label, seriesLabel, interval, intlLocale, }: ChartTooltipProps & { seriesLabel: string; interval: TimeSeriesInterval; intlLocale: string; })
