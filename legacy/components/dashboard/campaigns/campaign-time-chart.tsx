"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";

interface TimelineData {
  date: string;
  clicks: number;
}

interface CampaignTimeChartProps {
  data: TimelineData[];
  loading?: boolean;
}

export function CampaignTimeChart({ data, loading }: CampaignTimeChartProps) {
  const t = useTranslations("campaign-time-chart");

  const chartConfig = {
    clicks: {
      label: t("clicks"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;
  if (loading) {
    return (
      <Card className="w-full">
        <div className="px-6 py-0">
          <CardTitle className="text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <CardContent className="px-6 py-0">
          <Skeleton className="w-full h-[300px] rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full">
        <div className="px-6 py-0">
          <CardTitle className="text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <CardContent className="px-6 py-0">
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">{t("no-data-title")}</p>
            <p className="text-sm">{t("no-data-description")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxClicks = Math.max(...data.map((d) => d.clicks));
  const totalClicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const avgClicks = Math.round(totalClicks / data.length);

  return (
    <Card className="w-full">
      <div className="px-6 py-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">
                {t("total")}
              </span>
              <span className="font-semibold">
                {totalClicks.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">
                {t("daily-avg")}
              </span>
              <span className="font-semibold">
                {avgClicks.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground text-xs">{t("peak")}</span>
              <span className="font-semibold">
                {maxClicks.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="p-6 pt-4">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[300px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 0,
              right: 0,
              top: 10,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
                <stop
                  offset="100%"
                  stopColor="var(--chart-1)"
                  stopOpacity={0.6}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-muted"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                return value.toString();
              }}
              className="text-xs"
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              content={
                <ChartTooltipContent
                  className="w-40 bg-popover border shadow-lg"
                  nameKey="clicks"
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                />
              }
            />
            <Bar
              dataKey="clicks"
              fill="url(#clicksGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
