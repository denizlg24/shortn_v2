"use client";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { CardContent } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
export const description = "An interactive bar chart";
export function QRCodeTimeBarChart({
  chartData,
  type,
}: {
  type: "click" | "scan";
  chartData: { date: string; scans: number }[];
}) {
  const chartConfig = {
    scans: {
      label: type == "click" ? "Clicks" : "Scans",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;
  return (
    <CardContent className="p-0">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-[250px] w-full"
      >
        <BarChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 12,
            right: 12,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[150px]"
                nameKey="scans"
                labelFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                }
              />
            }
          />
          <Bar dataKey="scans" fill="var(--chart-1)" />
        </BarChart>
      </ChartContainer>
    </CardContent>
  );
}
