"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Link } from "@/i18n/navigation";
import { ClickEntry } from "@/models/url/Click";
import { useClicks } from "@/utils/ClickDataContext";
import { ChevronDownIcon, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "../tables/utm-table/data-table";
import { utmColumns } from "../tables/utm-table/columns";
import { DateRange } from "react-day-picker";
import { format } from "date-fns/format";
import { endOfDay } from "date-fns/endOfDay";
import { startOfDay } from "date-fns/startOfDay";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
import { DownloadButtonCSV } from "./download-csv-button";

export const LinkUtmStats = ({
  unlocked,
  initialClicks,
  createdAt,
}: {
  unlocked: boolean;
  initialClicks: ClickEntry[];
  createdAt: Date;
}) => {
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
          new Date(now.getFullYear(), now.getMonth() - 1, 1),
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

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [mobileStartOpened, mobileStartOpen] = useState(false);
  const [mobileEndOpened, mobileEndOpen] = useState(false);
  const { getClicks, urlCode } = useClicks();
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState<ClickEntry[]>(initialClicks);

  const isInitialRender = useRef(true);

  useEffect(() => {
    if (unlocked) {
      if (isInitialRender.current) {
        isInitialRender.current = false;
        return;
      }
      getClicks(
        dateRange?.from ? dateRange.from.toDateString() : undefined,
        dateRange?.to ? dateRange.to.toDateString() : undefined,
        setClicks,
        setLoading,
      );
    }
  }, [dateRange, unlocked, getClicks]);
  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">UTM stats</h1>
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
                  to see UTM data.
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

  if (loading) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
        <div className="w-full flex flex-col gap-1 items-start">
          <CardTitle className="w-full flex flex-row items-center justify-between">
            <>UTM Stats</>
          </CardTitle>
          <CardDescription>
            Showing UTM stats of short link&apos;s clicks
          </CardDescription>
        </div>
        <Skeleton className="w-full h-[200px]" />
      </div>
    );
  }

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle className="w-full flex flex-row items-center justify-between">
          <>UTM Stats</>
        </CardTitle>
        <CardDescription>
          Showing UTM stats of short link&apos;s clicks
        </CardDescription>
      </div>
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
                    dateRange.to ? `-${format(dateRange.to, "dd/MM/yyyy")}` : ""
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
                      onClick={() => setDateRange(getDateRange(opt, createdAt))}
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
      <DataTable
        columns={utmColumns()}
        data={clicks
          .filter(
            (c) => !!c.queryParams && Object.keys(c.queryParams).length > 0,
          )
          .map((click) => ({
            timestamp: click.timestamp,
            utm_campaign: click.queryParams?.utm_campaign,
            utm_source: click.queryParams?.utm_source,
            utm_medium: click.queryParams?.utm_medium,
            utm_term: click.queryParams?.utm_term,
            utm_content: click.queryParams?.utm_content,
          }))}
      />
      <DownloadButtonCSV
        data={clicks
          .filter(
            (c) => !!c.queryParams && Object.keys(c.queryParams).length > 0,
          )
          .map((click) => ({
            timestamp: click.timestamp,
            utm_campaign: click.queryParams?.utm_campaign,
            utm_source: click.queryParams?.utm_source,
            utm_medium: click.queryParams?.utm_medium,
            utm_term: click.queryParams?.utm_term,
            utm_content: click.queryParams?.utm_content,
          }))}
        filename={`${urlCode}-utm-stats`}
      />
    </div>
  );
};
