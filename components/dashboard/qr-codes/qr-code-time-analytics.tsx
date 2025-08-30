import { IUrl } from "@/models/url/UrlV3";
import {
  format,
  eachDayOfInterval,
  isWithinInterval,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { IQRCode } from "@/models/url/QRCodeV2";
import { QRCodeTimeBarChart } from "./charts/qr-code-time-bar-chart";
export const getScansOverTimeData = (
  url: IQRCode,
  startDate?: Date,
  endDate?: Date
) => {
  const defaultEnd = endOfDay(new Date());
  const defaultStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth() - 2,
    1
  );

  const rangeStart = startDate ? startOfDay(startDate) : defaultStart;
  const rangeEnd = endDate ? endOfDay(endDate) : defaultEnd;

  const grouped: Record<string, number> = {};

  for (const click of url.clicks.all) {
    if (
      isWithinInterval(click.timestamp, { start: rangeStart, end: rangeEnd })
    ) {
      const dateKey = format(click.timestamp, "yyyy-MM-dd");
      if (!grouped[dateKey]) {
        grouped[dateKey] = 1;
      } else {
        grouped[dateKey]++;
      }
    }
  }

  const allDates = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  return allDates.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return {
      date: key,
      scans: grouped[key] ?? 0,
    };
  });
};

export const QRCodeTimeAnalytics = ({
  unlocked,
  qrCodeData,
}: {
  unlocked: boolean;
  qrCodeData: IQRCode;
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const chartData = getScansOverTimeData(
    qrCodeData,
    dateRange?.from,
    dateRange?.to
  );

  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            Scans over time
          </h1>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button className="xs:rounded-xl! p-1! px-2! h-fit! rounded! text-xs xs:w-fit w-full hover:cursor-help">
                <Lock />
                Upgrade
              </Button>
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
                  to see data about your engagements over time
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
  return (
    <QRCodeTimeBarChart
      createdAt={qrCodeData.date}
      className="p-0!"
      dateRange={dateRange}
      setDateRange={setDateRange}
      chartData={chartData}
    />
  );
};
