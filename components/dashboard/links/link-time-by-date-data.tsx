"use client";
import { IUrl } from "@/models/url/UrlV3";

import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, Lock, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ScrollPopoverContent } from "@/components/ui/scroll-popover-content";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  groupClicksByDateAndTimeBuckets,
  TimeOfDayStackedBarChart,
} from "./charts/time-of-day-stacked-bar-chart";

export const LinkTimeByDateData = ({
  unlocked,
  linkData,
  createdAt,
}: {
  unlocked: boolean;
  linkData: IUrl;
  createdAt: Date;
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [mobileStartOpened, mobileStartOpen] = useState(false);
  const [mobileEndOpened, mobileEndOpen] = useState(false);

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
    if (!range?.from || !range?.to) return "for this month";

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

  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            Engagements over Time and Date
          </h1>
          <HoverCard>
            <HoverCardTrigger className="xs:rounded-xl! bg-primary flex flex-row items-center text-primary-foreground p-1! px-2! h-fit! rounded! text-xs gap-2 font-semibold xs:w-fit w-full hover:cursor-help">
              <Lock className="w-4 h-4" />
              Upgrade
            </HoverCardTrigger>
            <HoverCardContent asChild>
              <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                <p className="w-full">
                  <Link
                    href={`/dashboard/subscription`}
                    className="underline hover:cursor-pointer"
                  >
                    Upgrade
                  </Link>{" "}
                  to see Engagements over Time and Date data.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="w-full h-auto">
          <Image
            src={scansOverTimeLocked}
            alt="Scans over time locked illustration"
            className="w-full h-full object-cover  min-h-[150px]"
          />
        </div>
      </div>
    );
  }

  const groupedData = groupClicksByDateAndTimeBuckets(
    linkData.clicks.all,
    6,
    dateRange?.from,
    dateRange?.to
  );
  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4 justify-between">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle>Engagements over Time and Date</CardTitle>
        <CardDescription>
          Showing engagements over time and date data{" "}
          {formatHumanDateRange(dateRange, createdAt)}.
        </CardDescription>
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
                      dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : ""
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
                    onClick={() => setDateRange(getDateRange(opt, createdAt))}
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
                  Select the date from which to start displaying click data.
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
                    onClick={() => setDateRange(getDateRange(opt, createdAt))}
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
                      Select the date from which to stop displaying click data.
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
      </div>
      <div className="w-full flex flex-col gap-2">
        <TimeOfDayStackedBarChart chartData={groupedData} />
      </div>
    </div>
  );
};
