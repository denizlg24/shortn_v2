"use client";
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
import { useEffect, useState } from "react";
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
} from "../links/charts/time-of-day-stacked-bar-chart";
import { ClickEntry } from "@/models/url/Click";
import { useScans } from "@/utils/ScanDataContext";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadButtonCSV } from "../links/download-csv-button";
import { useTranslations } from "next-intl";

export const QRCodeTimeByDateData = ({
  unlocked,
  createdAt,
}: {
  unlocked: boolean;
  createdAt: Date;
}) => {
  const t = useTranslations("qr-code-time-by-date-data");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [mobileStartOpened, mobileStartOpen] = useState(false);
  const [mobileEndOpened, mobileEndOpen] = useState(false);
  const { getScans, urlCode } = useScans();
  const [loading, setLoading] = useState(true);
  const [clicks, setClicks] = useState<ClickEntry[]>([]);
  const dateRangeOptions = [
    { key: "this-month", label: t("this-month") },
    { key: "last-month", label: t("last-month") },
    { key: "last-3-months", label: t("last-3-months") },
    { key: "last-6-months", label: t("last-6-months") },
    { key: "last-9-months", label: t("last-9-months") },
    { key: "last-year", label: t("last-year") },
    { key: "all-time", label: t("all-time") },
  ];
  function getDateRange(option: string, createdAt: Date): DateRange {
    const now = endOfDay(new Date());
    setOpen(false);
    mobileStartOpen(false);
    mobileEndOpen(false);
    switch (option) {
      case "this-month":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
          to: now,
        };

      case "last-month": {
        const from = startOfDay(
          new Date(now.getFullYear(), now.getMonth() - 1, 1),
        );
        const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        return { from, to };
      }

      case "last-3-months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
          to: now,
        };

      case "last-6-months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
          to: now,
        };

      case "last-9-months":
        return {
          from: startOfDay(new Date(now.getFullYear(), now.getMonth() - 8, 1)),
          to: now,
        };

      case "last-year":
        return {
          from: startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), 1)),
          to: now,
        };

      case "all-time":
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
    createdAt: Date,
  ): string {
    if (!range?.from || !range?.to) return t("for-this-month");

    const now = endOfDay(new Date());
    const from = startOfDay(range.from);
    const to = endOfDay(range.to);

    if (
      isSameDay(from, startOfDay(createdAt)) &&
      Math.abs(to.getTime() - now.getTime()) < 1000 * 60 * 60 * 24
    ) {
      return t("of-all-time");
    }

    if (Math.abs(to.getTime() - now.getTime()) < 1000 * 60 * 60 * 24) {
      const diffMonths =
        now.getMonth() -
        from.getMonth() +
        12 * (now.getFullYear() - from.getFullYear());
      const diffYears = now.getFullYear() - from.getFullYear();
      if (diffYears >= 1 && diffMonths >= 12)
        return diffYears === 1
          ? t("for-last-year")
          : t("for-last-years", { years: diffYears });
      if (diffMonths === 0) return t("for-this-month");
      if (diffMonths === 1) return t("for-last-month");
      return t("for-last-months", { months: diffMonths + 1 });
    }

    return t("from-to", {
      start: format(from, "d MMM yyyy"),
      end: format(to, "d MMM yyyy"),
    });
  }

  useEffect(() => {
    if (unlocked) {
      getScans(
        dateRange?.from ? dateRange.from.toDateString() : undefined,
        dateRange?.to ? dateRange.to.toDateString() : undefined,
        setClicks,
        setLoading,
      );
    }
  }, [unlocked, getScans, dateRange]);

  const dateToday = format(new Date(), "yyyy-MM-dd");
  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            {t("title")}
          </h1>
          <HoverCard>
            <HoverCardTrigger className="xs:rounded-xl! bg-primary flex flex-row items-center text-primary-foreground p-1! px-2! h-fit! rounded! text-xs gap-2 font-semibold xs:w-fit w-full hover:cursor-help">
              <Lock className="w-4 h-4" />
              {t("upgrade")}
            </HoverCardTrigger>
            <HoverCardContent asChild>
              <div className="w-full max-w-[300px] p-2! px-3! rounded bg-primary text-primary-foreground flex flex-col gap-0 items-start text-xs cursor-help">
                <p className="w-full">
                  <Link
                    href={`/dashboard/subscription`}
                    className="underline hover:cursor-pointer"
                  >
                    {t("upgrade")}
                  </Link>{" "}
                  {t("to-see-data")}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="w-full h-auto">
          <Image
            src={scansOverTimeLocked}
            alt={t("locked-alt")}
            className="w-full h-full object-cover  min-h-[150px]"
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4 justify-between">
        <div className="w-full flex flex-col gap-1 items-start">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {t("description")} {formatHumanDateRange(dateRange, createdAt)}.
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
                        dateRange.from
                          ? format(dateRange.from, "dd/MM/yyyy")
                          : ""
                      }${
                        dateRange.to
                          ? `-${format(dateRange.to, "dd/MM/yyyy")}`
                          : ""
                      }`
                    : t("select-period")}
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
                  {dateRangeOptions.map((opt) => (
                    <Button
                      key={opt.key}
                      variant="secondary"
                      className="text-xs p-2 h-fit grow"
                      onClick={() =>
                        setDateRange(getDateRange(opt.key, createdAt))
                      }
                    >
                      {opt.label}
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
                    : t("select-start-date")}
                  <ChevronDownIcon />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
                <DialogHeader className="px-4">
                  <DialogTitle>{t("select-start-date-title")}</DialogTitle>
                  <DialogDescription>
                    {t("start-date-description")}
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
                  {dateRangeOptions.map((opt) => (
                    <Button
                      key={opt.key}
                      variant="secondary"
                      className="text-xs p-2 h-fit grow"
                      onClick={() =>
                        setDateRange(getDateRange(opt.key, createdAt))
                      }
                    >
                      {opt.label}
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
                        : t("end")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
                    <DialogHeader className="px-4">
                      <DialogTitle>{t("select-end-date")}</DialogTitle>
                      <DialogDescription>
                        {t("end-date-description")}
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
                      {dateRangeOptions.map((opt) => (
                        <Button
                          key={opt.key}
                          variant="secondary"
                          className="text-xs p-2 h-fit grow"
                          onClick={() =>
                            setDateRange(getDateRange(opt.key, createdAt))
                          }
                        >
                          {opt.label}
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
                {t("clear-period")}
              </Button>
            )}
          </div>
        </div>
        <Skeleton className="w-full h-[250px]" />
      </div>
    );
  }

  const groupedData = groupClicksByDateAndTimeBuckets(
    clicks,
    6,
    dateRange?.from,
    dateRange?.to,
  );
  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4 justify-between">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description")} {formatHumanDateRange(dateRange, createdAt)}.
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
                  : t("select-period")}
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
                {dateRangeOptions.map((opt) => (
                  <Button
                    key={opt.key}
                    variant="secondary"
                    className="text-xs p-2 h-fit grow"
                    onClick={() =>
                      setDateRange(getDateRange(opt.key, createdAt))
                    }
                  >
                    {opt.label}
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
                  : t("select-start-date")}
                <ChevronDownIcon />
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
              <DialogHeader className="px-4">
                <DialogTitle>{t("select-start-date-title")}</DialogTitle>
                <DialogDescription>
                  {t("start-date-description")}
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
                {dateRangeOptions.map((opt) => (
                  <Button
                    key={opt.key}
                    variant="secondary"
                    className="text-xs p-2 h-fit grow"
                    onClick={() =>
                      setDateRange(getDateRange(opt.key, createdAt))
                    }
                  >
                    {opt.label}
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
                      : t("end")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[320px] overflow-hidden p-0 md:hidden flex flex-col gap-0 pt-6">
                  <DialogHeader className="px-4">
                    <DialogTitle>{t("select-end-date")}</DialogTitle>
                    <DialogDescription>
                      {t("end-date-description")}
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
                    {dateRangeOptions.map((opt) => (
                      <Button
                        key={opt.key}
                        variant="secondary"
                        className="text-xs p-2 h-fit grow"
                        onClick={() =>
                          setDateRange(getDateRange(opt.key, createdAt))
                        }
                      >
                        {opt.label}
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
              {t("clear-period")}
            </Button>
          )}
        </div>
      </div>
      <div className="w-full flex flex-col gap-2">
        <TimeOfDayStackedBarChart chartData={groupedData} />
      </div>
      {clicks.length > 0 && (
        <DownloadButtonCSV
          filename={`${urlCode}-scan-time-date-data-${dateToday}`}
          data={groupedData
            .map((val) => {
              const date = val.date;
              const newVal: { date?: string } = { ...val };
              delete newVal["date"];
              if (
                new Date(new Date(date).toDateString()) >=
                new Date(createdAt.toDateString())
              ) {
                return {
                  Date: date,
                  ...newVal,
                };
              }
              return null;
            })
            .filter((val) => val !== null)}
        />
      )}
    </div>
  );
};
