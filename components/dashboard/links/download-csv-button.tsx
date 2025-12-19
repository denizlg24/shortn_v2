"use client";

import { generateCSVFromClicks } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/authClient";
import { cn, fetchApi } from "@/lib/utils";
import { Download, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SubscriptionsType } from "@/utils/plan-utils";

export const DownloadButtonCSV = ({
  filename,
  data,
  className,
  title,
  lockedTitle,
}: {
  filename: string;
  data: unknown[];
  className?: string;
  lockedTitle?: string;
  title?: string;
}) => {
  const { isPending, isRefetching } = authClient.useSession();
  const [plan, setPlan] = useState<SubscriptionsType>("free");
  useEffect(() => {
    if (isPending || isRefetching) {
      return;
    }
    const fetchPlan = async () => {
      const res = await fetchApi<{ plan: SubscriptionsType; lastPaid?: Date }>(
        "auth/user/subscription",
      );

      if (res.success) {
        console.log("Fetched plan:", res.plan);
        setPlan(res.plan);
      } else {
        setPlan("free");
      }
    };
    fetchPlan();
  }, [isPending, isRefetching]);
  return plan == "pro" ? (
    <Button
      className={cn("min-[420px]:text-sm text-xs", className)}
      onClick={async () => {
        toast.promise<{ success: boolean; url: string }>(
          async () => {
            console.log("Data to be converted to CSV:", data);
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
                a.download = `${filename}.csv`;
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
      {title ?? "Export to CSV file"} <Download />
    </Button>
  ) : (
    <Button className="min-[420px]:text-sm text-xs" asChild>
      <Link href={"/dashboard/subscription"}>
        {lockedTitle ?? "Upgrade to download data as a CSV file."}{" "}
        <Lock className="w-3! h-3!" />
      </Link>
    </Button>
  );
};
