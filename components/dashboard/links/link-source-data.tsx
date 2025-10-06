import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  aggregateReferrers,
  ReferrerDonutChart,
} from "./charts/referrer-donut-chart";
import { ClickEntry } from "@/models/url/Click";

export const LinkSourceData = ({
  unlocked,
  clicks,
}: {
  unlocked: boolean;
  clicks: ClickEntry[];
}) => {
  if (!unlocked) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-0">
        <div className="flex xs:flex-row flex-col xs:gap-0 gap-2 items-center justify-between w-full">
          <h1 className="font-bold md:text-lg text-base truncate">
            Referrer data
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
                  to see referrer data.
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

  const data = aggregateReferrers(clicks);

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle>Referrer Data</CardTitle>
        <CardDescription>
          Showing referrer data of short link&apos;s clicks
        </CardDescription>
      </div>
      <div className="w-full flex flex-col gap-2">
        {data.length > 0 && (
          <ReferrerDonutChart chartData={data} labelTitle="Clicks" />
        )}
        {data.length == 0 && (
          <p className="text-sm font-semibold mx-auto text-center my-8">
            No data available for this link
          </p>
        )}
      </div>
    </div>
  );
};
