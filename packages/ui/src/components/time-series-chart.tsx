"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { formatDate, formatNumber, formatShortDate } from "../lib/format";

type ChartTooltipProps = TooltipContentProps<TooltipValueType, string | number>;

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export type TimeSeriesInterval = "hour" | "day" | "week" | "month";

export interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  /** Series name used in the tooltip and accessible label, e.g. "Clicks". */
  seriesLabel: string;
  /** Bucket size of each point; picks the axis and tooltip date formats. */
  interval?: TimeSeriesInterval;
  height?: number;
  className?: string;
}

function formatTick(
  date: Date,
  interval: TimeSeriesInterval,
  intlLocale: string,
) {
  if (interval === "hour")
    return new Intl.DateTimeFormat(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  if (interval === "month")
    return new Intl.DateTimeFormat(intlLocale, {
      month: "short",
      year: "2-digit",
    }).format(date);
  return formatShortDate(date, intlLocale);
}

function formatPointLabel(
  date: Date,
  interval: TimeSeriesInterval,
  intlLocale: string,
) {
  if (interval === "hour") return formatDate(date, intlLocale, true);
  if (interval === "month")
    return new Intl.DateTimeFormat(intlLocale, {
      month: "long",
      year: "numeric",
    }).format(date);
  return formatDate(date, intlLocale);
}

const axisTick = {
  fill: "var(--fg-subtle)",
  fontSize: 11,
  fontFamily: "var(--font-data)",
};

export function TimeSeriesChart({
  data,
  seriesLabel,
  interval = "day",
  height = 168,
  className,
}: TimeSeriesChartProps) {
  const { intlLocale } = useUILocale();
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            tickMargin={8}
            minTickGap={48}
            interval="preserveStartEnd"
            tickFormatter={(value: string) =>
              formatTick(new Date(value), interval, intlLocale)
            }
          />
          <YAxis
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={axisTick}
            width={40}
            tickCount={3}
            allowDecimals={false}
            tickFormatter={(value: number) => formatNumber(value, intlLocale)}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={(props: ChartTooltipProps) => (
              <ChartTooltip
                {...props}
                seriesLabel={seriesLabel}
                interval={interval}
                intlLocale={intlLocale}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={seriesLabel}
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            fill="var(--chart-1)"
            fillOpacity={0.07}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: "var(--chart-1)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  seriesLabel,
  interval,
  intlLocale,
}: ChartTooltipProps & {
  seriesLabel: string;
  interval: TimeSeriesInterval;
  intlLocale: string;
}) {
  const point = payload?.[0];
  if (!active || !point || typeof label !== "string") return null;
  return (
    <div className="rounded-control border border-line bg-overlay px-2.5 py-1.5 text-meta shadow-overlay">
      <div className="text-fg-muted">
        {formatPointLabel(new Date(label), interval, intlLocale)}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="size-2 translate-y-[-1px] rounded-full bg-chart-1"
          aria-hidden
        />
        <span className="text-fg-muted">{seriesLabel}</span>
        <span className="ml-auto pl-3 font-mono font-medium text-fg tabular-nums">
          {formatNumber(Number(point.value ?? 0), intlLocale)}
        </span>
      </div>
    </div>
  );
}
