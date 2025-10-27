"use client";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  eachDayOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  startOfDay,
  subDays,
} from "date-fns";
import { ClickEntry } from "@/models/url/Click";
export const description = "A stacked bar chart with a legend";

export function groupClicksByDateAndReferrer(
  clicks: ClickEntry[],
  startDate?: Date,
  endDate?: Date,
): StackedBarData[] {
  const defaultEnd = endOfDay(new Date());
  const defaultStart = startOfDay(subDays(defaultEnd, 31));

  const rangeStart = startDate ? startOfDay(startDate) : defaultStart;
  const rangeEnd = endDate ? endOfDay(endDate) : defaultEnd;

  const counts: Record<string, Record<string, number>> = {};
  const allReferrers = new Set<string>();

  for (const click of clicks) {
    if (
      !isWithinInterval(new Date(click.timestamp), {
        start: rangeStart,
        end: rangeEnd,
      })
    ) {
      continue;
    }

    const dateKey = format(new Date(click.timestamp), "yyyy-MM-dd");

    let ref = click.referrer?.trim();
    if (!ref) {
      ref = "direct";
    } else {
      try {
        const url = new URL(ref);
        ref = url.hostname.replace(/^www\./, "");
      } catch {
        ref = ref.replace(/^www\./, "");
      }
    }

    allReferrers.add(ref);

    if (!counts[dateKey]) counts[dateKey] = {};
    counts[dateKey][ref] = (counts[dateKey][ref] ?? 0) + 1;
  }

  const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  return allDates.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const refData = counts[key] ?? {};

    const entry: StackedBarData = { date: key };
    allReferrers.forEach((ref) => {
      entry[ref] = refData[ref] ?? 0;
    });

    return entry;
  });
}

function generateChartConfig(data: StackedBarData[]) {
  const referrerKeys = Object.keys(data[0]).filter((k) => k !== "date");

  return Object.fromEntries(
    referrerKeys.map((key, i) => {
      const label =
        key === "direct"
          ? "direct"
          : key.length > 20
            ? key.slice(0, 17) + "…"
            : key;

      return [
        key,
        {
          label,
          color: `var(--chart-${(i % 5) + 1})`,
        },
      ];
    }),
  ) satisfies ChartConfig;
}

export type StackedBarData = {
  date: string;
  [referrer: string]: number | string;
};

export function ReferrerStackedBarChart({
  chartData,
}: {
  chartData: StackedBarData[];
}) {
  if (!chartData.length) return null;
  const referrerKeys = Array.from(
    chartData.reduce((acc, d) => {
      Object.keys(d).forEach((k) => {
        if (k !== "date") acc.add(k);
      });
      return acc;
    }, new Set<string>()),
  );
  const chartConfig = generateChartConfig(chartData);
  return (
    <Card className="border-none p-0 shadow-none w-full">
      <CardContent className="p-0">
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            {referrerKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={`var(--chart-${(i % 5) + 1})`}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
