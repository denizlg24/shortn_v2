"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  differenceInMonths,
  differenceInYears,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
export const description = "An interactive bar chart";

const chartConfig = {
  scans: {
    label: "Scans",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function QRCodeTimeBarChart({
  chartData,
  setDateRange,
  dateRange,
  className,
  createdAt,
}: {
  setDateRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  dateRange: DateRange | undefined;
  createdAt: Date;
  chartData: { date: string; scans: number }[];
  className?: string;
}) {
  const total = () => chartData.reduce((acc, curr) => acc + curr.scans, 0);

  const [open, setOpen] = React.useState(false);
  const [mobileStartOpened, mobileStartOpen] = React.useState(false);
  const [mobileEndOpened, mobileEndOpen] = React.useState(false);

  function getDateRange(option: string, createdAt: Date): DateRange {
    const now = endOfDay(new Date());
    setOpen(false);
    mobileStartOpen(false);
    mobileEndOpen(false);
    switch (option) {
      case "This month":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
          to: now,
        };

      case "Last month": {
        const from = startOfDay(
          new Date(now.getFullYear(), now.getMonth() - 1, 1)
        );
        const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        return { from, to };
      }

      case "Last 3 months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
          to: now,
        };

      case "Last 6 months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
          to: now,
        };

      case "Last 9 months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 8, 1)),
          to: now,
        };

      case "Last year":
        return {
          from: startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), 1)),
          to: now,
        };

      case "All time":
        return {
          from: startOfDay(new Date(createdAt)),
          to: now,
        };

      default:
        return { from: undefined, to: undefined };
    }
  }

  function formatHumanDateRange(
    range: DateRange | undefined,
    createdAt: Date
  ): string {
    if (!range?.from || !range?.to) return "for the last 3 months";

    const now = endOfDay(new Date());
    const from = startOfDay(range.from);
    const to = endOfDay(range.to);

    if (
      isSameDay(from, startOfDay(createdAt)) &&
      Math.abs(to.getTime() - now.getTime()) < 1000 * 60 * 60 * 24
    ) {
      return "of all time";
    }

    if (Math.abs(to.getTime() - now.getTime()) < 1000 * 60 * 60 * 24) {
      const diffMonths =
        now.getMonth() -
        from.getMonth() +
        12 * (now.getFullYear() - from.getFullYear());
      const diffYears = now.getFullYear() - from.getFullYear();
      if (diffYears >= 1 && diffMonths >= 12)
        return diffYears === 1
          ? "for last year"
          : `for the last ${diffYears} years`;
      if (diffMonths === 0) return "for this month";
      if (diffMonths === 1) return "for last month";
      return `for the last ${diffMonths + 1} months`;
    }

    return `from ${format(from, "d MMM yyyy")} to ${format(to, "d MMM yyyy")}`;
  }

  return (
    <div
      className={cn(
        "lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col sm:gap-0 gap-4",
        className
      )}
    >
      <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3">
          <CardTitle>Scans over time</CardTitle>
          <CardDescription className="flex flex-col gap-2">
            <p>
              Showing total QR Code scans{" "}
              {formatHumanDateRange(dateRange, createdAt)}
            </p>
            <div className="w-full flex flex-row items-center gap-2 flex-wrap">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    id="date"
                    className="w-full max-w-48 justify-between font-normal md:flex hidden"
                  >
                    {dateRange
                      ? `${
                          dateRange.from
                            ? format(dateRange.from, "dd/MM/yyyy")
                            : ""
                        }${
                          dateRange.to
                            ? `-${format(dateRange.to, "dd/MM/yyyy")}`
                            : ""
                        }`
                      : "Select a period"}
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>
                <ScrollPopoverContent
                  className="w-auto md:max-w-[488px] max-w-[300px] overflow-hidden p-0 md:flex hidden flex-col gap-0"
                  align="start"
                >
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    showOutsideDays={false}
                    fixedWeeks
                    selected={dateRange}
                    disabled={(date) => {
                      return date > new Date();
                    }}
                    onSelect={(range) => {
                      if (range?.from && range?.to && range.to != range.from) {
                        setDateRange(range);
                        setOpen(false);
                      } else {
                        if (range?.from) {
                          setDateRange((prev) => {
                            return { ...prev, from: range.from };
                          });
                        } else if (range?.to) {
                          setDateRange((prev) => {
                            return { from: prev?.from, to: range.from };
                          });
                          setOpen(false);
                        }
                      }
                    }}
                  />
                  <Separator className="mb-2" />
                  <div className="flex flex-row items-center w-full flex-wrap gap-2 p-3">
                    {[
                      "This month",
                      "Last month",
                      "Last 3 months",
                      "Last 6 months",
                      "Last 9 months",
                      "Last year",
                      "All time",
                    ].map((opt) => (
                      <Button
                        key={opt}
                        variant="secondary"
                        className="text-xs p-2 h-fit grow"
                        onClick={() =>
                          setDateRange(getDateRange(opt, createdAt))
                        }
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </ScrollPopoverContent>
              </Popover>
              <Dialog open={mobileStartOpened} onOpenChange={mobileStartOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    id="date"
                    className="grow flex-1 max-w-48 justify-between font-normal md:hidden flex px-2"
                  >
                    {dateRange?.from
                      ? `${format(dateRange.from, "dd/MM/yyyy")}`
                      : "Select a start date"}
                    <ChevronDownIcon />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
                  <DialogHeader className="px-4">
                    <DialogTitle>Select start date</DialogTitle>
                    <DialogDescription>
                      Select the date from which to start displaying scan data.
                    </DialogDescription>
                  </DialogHeader>
                  <Calendar
                    mode="single"
                    showOutsideDays={false}
                    numberOfMonths={1}
                    selected={dateRange?.from}
                    captionLayout="label"
                    className="mx-auto"
                    onSelect={(date) => {
                      if (!date) {
                        setDateRange(undefined);
                      }
                      setDateRange((prev) => {
                        return { ...prev, from: date };
                      });
                      mobileStartOpen(false);
                    }}
                  />
                  <Separator className="mb-2" />
                  <div className="flex flex-row items-center w-full flex-wrap gap-2 p-3 md:max-w-[488px] max-w-[320px]">
                    {[
                      "This month",
                      "Last month",
                      "Last 3 months",
                      "Last 6 months",
                      "Last 9 months",
                      "Last year",
                      "All time",
                    ].map((opt) => (
                      <Button
                        key={opt}
                        variant="secondary"
                        className="text-xs p-2 h-fit grow"
                        onClick={() =>
                          setDateRange(getDateRange(opt, createdAt))
                        }
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
              {dateRange?.from && (
                <>
                  <p className="md:hidden">-</p>
                  <Dialog open={mobileEndOpened} onOpenChange={mobileEndOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        id="date"
                        className="grow flex-1 justify-between font-normal md:hidden flex px-2"
                      >
                        {dateRange?.to
                          ? `${format(dateRange.to, "dd/MM/yyyy")}`
                          : "End"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
                      <DialogHeader className="px-4">
                        <DialogTitle>Select end date</DialogTitle>
                        <DialogDescription>
                          Select the date from which to stop displaying scan
                          data.
                        </DialogDescription>
                      </DialogHeader>
                      <Calendar
                        mode="single"
                        showOutsideDays={false}
                        numberOfMonths={1}
                        selected={dateRange?.from}
                        captionLayout="label"
                        className="mx-auto"
                        onSelect={(date) => {
                          setDateRange((prev) => {
                            if (prev?.from) {
                              return { ...prev, to: date };
                            }
                            return prev;
                          });
                          mobileEndOpen(false);
                        }}
                      />
                      <Separator className="mb-2" />
                      <div className="flex flex-row items-center w-full flex-wrap gap-2 p-3 md:max-w-[488px] max-w-[320px]">
                        {[
                          "This month",
                          "Last month",
                          "Last 3 months",
                          "Last 6 months",
                          "Last 9 months",
                          "Last year",
                          "All time",
                        ].map((opt) => (
                          <Button
                            key={opt}
                            variant="secondary"
                            className="text-xs p-2 h-fit grow"
                            onClick={() =>
                              setDateRange(getDateRange(opt, createdAt))
                            }
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {dateRange && (
                <Button
                  onClick={() => {
                    setOpen(false);
                    setDateRange(undefined);
                  }}
                  variant={"ghost"}
                >
                  <X />
                  Clear Period
                </Button>
              )}
            </div>
          </CardDescription>
        </div>
        <div className="flex">
          <button className="data-[active=true]:bg-muted/50 relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
            <span className="text-muted-foreground text-xs">Scans</span>
            <span className="text-lg leading-none font-bold sm:text-3xl">
              {total()}
            </span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
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
              tickMargin={8}
              minTickGap={32}
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
    </div>
  );
}
