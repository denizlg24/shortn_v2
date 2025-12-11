"use client";
import { Label, Pie, PieChart, TooltipProps } from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";

export type ReferrerStats = {
  referrer: string;
  clicks: number;
};

export const description = "A donut chart with text";

export function aggregateReferrers(
  clicks: { referrer?: string | null | undefined }[],
): ReferrerStats[] {
  const counts: Record<string, number> = {};

  for (const click of clicks) {
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

    counts[ref] = (counts[ref] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([referrer, clicks]) => ({ referrer, clicks }))
    .sort((a, b) => b.clicks - a.clicks);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReferrerTooltipContent(props: TooltipProps<any, any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { active, payload } = props as TooltipProps<any, any> & {
    payload?: {
      payload: ReferrerStats & { fill: string };
      fill?: string;
      color?: string;
    }[];
  };
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0].payload as { referrer: string; clicks: number };
  const sliceColor = payload[0].payload.fill;

  return (
    <div className="rounded-md border bg-background px-1 pr-2 py-1 text-sm shadow-md flex flex-row items-center gap-1 justify-between max-w-[150px] w-full">
      <span
        className="w-4 h-4 rounded shadow shrink-0"
        style={{ backgroundColor: sliceColor }}
      ></span>
      <span className="font-medium truncate grow max-w-[90%] text-xs">
        {entry.referrer}
      </span>
      <span className="max-w-[10%] shrink-0 text-xs">{entry.clicks}</span>
    </div>
  );
}

export function ReferrerDonutChart({
  chartData,
  labelTitle,
}: {
  chartData: ReferrerStats[];
  labelTitle: string;
}) {
  const chartConfig = Object.fromEntries(
    chartData.map((d, i) => [
      d.referrer.toLowerCase(),
      {
        label: d.referrer,
        color: `var(--chart-${(i % 5) + 1})`,
      },
    ]),
  ) satisfies ChartConfig;

  const totalClicks = chartData.reduce((acc, curr) => acc + curr.clicks, 0);

  return (
    <Card className="flex flex-co border-none shadow-none">
      <CardContent className="flex-1 p-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[323px]"
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<ReferrerTooltipContent />} />
            <Pie
              data={chartData.map((d, i) => ({
                ...d,
                fill: `var(--chart-${(i % 5) + 1})`,
              }))}
              dataKey="clicks"
              nameKey="referrer"
              innerRadius={60}
              strokeWidth={1}
            >
              <Label
                value={labelTitle}
                className="fill-muted-foreground translate-y-6"
                position={"center"}
              />
              <Label
                value={totalClicks}
                className="text-3xl font-bold fill-foreground"
                position={"center"}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="referrer" />}
              className="flex flex-row justify-center gap-2 flex-wrap w-full"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
