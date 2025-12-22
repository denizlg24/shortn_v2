"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ClickEntry } from "@/models/url/Click";
import {
  startOfDay,
  endOfDay,
  isWithinInterval,
  eachDayOfInterval,
  format,
  getHours,
} from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

export type TimeOfDayStackBarData = {
  date: string;
  [time: string]: number | string;
};

export function groupClicksByDateAndTimeBuckets(
  clicks: ClickEntry[],
  bucketSizeHours = 6,
  startDate?: Date,
  endDate?: Date,
): TimeOfDayStackBarData[] {
  const defaultEnd = endOfDay(new Date());
  const defaultStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 2,
    1,
  );

  const rangeStart = startDate ? startOfDay(startDate) : defaultStart;
  const rangeEnd = endDate ? endOfDay(endDate) : defaultEnd;

  const bucketsPerDay = Math.ceil(24 / bucketSizeHours);

  const grouped: Record<string, Record<string, number>> = {};

  const getBucketLabel = (hour: number) => {
    const bucketIndex = Math.floor(hour / bucketSizeHours);
    const startHour = bucketIndex * bucketSizeHours;
    const endHour = startHour + bucketSizeHours;
    return `${startHour.toString().padStart(2, "0")}:00-${endHour
      .toString()
      .padStart(2, "0")}:00`;
  };

  for (const click of clicks) {
    if (
      isWithinInterval(click.timestamp, { start: rangeStart, end: rangeEnd })
    ) {
      const dateKey = format(click.timestamp, "yyyy-MM-dd");
      const hour = getHours(click.timestamp);
      const bucketLabel = getBucketLabel(hour);

      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][bucketLabel]) grouped[dateKey][bucketLabel] = 0;

      grouped[dateKey][bucketLabel]++;
    }
  }

  const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  return allDates.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const buckets: Record<string, number> = {};

    for (let i = 0; i < bucketsPerDay; i++) {
      const startHour = i * bucketSizeHours;
      const endHour = startHour + bucketSizeHours;
      const label = `${startHour.toString().padStart(2, "0")}:00-${endHour
        .toString()
        .padStart(2, "0")}:00`;

      buckets[label] = grouped[key]?.[label] ?? 0;
    }

    return { date: key, ...buckets };
  });
}

function generateChartConfig(data: TimeOfDayStackBarData[]) {
  const timeOfDayKeys = Object.keys(data[0]).filter((k) => k !== "date");

  return Object.fromEntries(
    timeOfDayKeys.map((key, i) => {
      return [
        key,
        {
          key,
          color: `var(--chart-${(i % 5) + 1})`,
        },
      ];
    }),
  ) satisfies ChartConfig;
}

export const description = "A stacked bar chart with a legend";

export function TimeOfDayStackedBarChart({
  chartData,
}: {
  chartData: TimeOfDayStackBarData[];
}) {
  if (!chartData.length) return null;
  const timeOfDayKeys = Array.from(
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
        <ChartContainer
          className="h-[250px] w-full aspect-auto"
          config={chartConfig}
        >
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
            {timeOfDayKeys.map((key, i) => (
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
