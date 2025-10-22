import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Download, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import scansOverTimeLocked from "@/public/scans-over-time-upgrade.png";
import Image from "next/image";
import { CardDescription, CardTitle } from "@/components/ui/card";
import {
  aggregateReferrers,
  ReferrerDonutChart,
} from "./charts/referrer-donut-chart";
import { useClicks } from "@/utils/ClickDataContext";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ClickEntry } from "@/models/url/Click";
import { useUser } from "@/utils/UserContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateCSVFromClicks } from "@/app/actions/linkActions";
import { format } from "date-fns";

export const LinkSourceData = ({ unlocked }: { unlocked: boolean }) => {
  const { getClicks, urlCode } = useClicks();
  const [loading, setLoading] = useState(true);
  const [clicks, setClicks] = useState<ClickEntry[]>([]);
  const session = useUser();
  useEffect(() => {
    if (unlocked) getClicks(undefined, undefined, setClicks, setLoading);
  }, [getClicks, unlocked]);
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

  if (loading) {
    return (
      <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
        <div className="w-full flex flex-col gap-1 items-start">
          <CardTitle>Referrer Data</CardTitle>
          <CardDescription>
            Showing referrer data of short link&apos;s clicks
          </CardDescription>
        </div>
        <div className="w-full flex flex-col gap-2">
          <Skeleton className="w-full h-[323px]" />
        </div>
      </div>
    );
  }

  const data = aggregateReferrers(clicks);

  return (
    <div className="lg:p-6 sm:p-4 p-3 rounded bg-background shadow w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-1 items-start">
        <CardTitle className="w-full flex flex-row items-center justify-between">
          <>Referrer Data</>
        </CardTitle>
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
      {session?.user?.plan.subscription == "pro" ? (
        <Button
          className="min-[420px]:text-sm text-xs min-[420px]:px-4 px-1  max-[420px]:h-fit! max-[420px]:py-0.5"
          onClick={async () => {
            toast.promise<{ success: boolean; url: string }>(
              async () => {
                const response = await generateCSVFromClicks({
                  clicks: data,
                });
                return response;
              },
              {
                loading: "Preparing your download...",
                success: (response) => {
                  if (response.success) {
                    const a = document.createElement("a");
                    a.href = response.url;
                    a.download = `${urlCode}-referrer-data-${format(Date.now(), "dd-MM-yyyy")}.csv`;
                    a.click();
                    return `Your download is ready and should start now.`;
                  }
                  return "There was an error creating your download.";
                },
                error: "There was an error creating your download.",
              },
            );
          }}
          variant={"secondary"}
        >
          Download Clicks <Download />
        </Button>
      ) : (
        <Button
          className="min-[420px]:text-sm text-xs min-[420px]:px-4 px-1  max-[420px]:h-fit! max-[420px]:py-0.5"
          asChild
        >
          <Link href={"/dashboard/subscription"}>
            Upgrade to download data. <Lock className="w-3! h-3!" />
          </Link>
        </Button>
      )}
    </div>
  );
};
