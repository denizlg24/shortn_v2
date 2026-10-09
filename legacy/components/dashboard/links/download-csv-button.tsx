"use client";

import { generateCSVFromClicks } from "@/app/actions/linkActions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { usePlan } from "@/hooks/use-plan";
import { useTranslations } from "next-intl";

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
  const { plan } = usePlan();
  const t = useTranslations("download-csv");
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
            loading: t("toast.loading"),
            success: (response) => {
              if (response.success) {
                const a = document.createElement("a");
                a.href = response.url;
                a.download = `${filename}.csv`;
                a.click();
                return t("toast.success");
              }
              return t("toast.error");
            },
            error: t("toast.error"),
          },
        );
      }}
      variant={"secondary"}
    >
      {title ?? t("export")} <Download />
    </Button>
  ) : (
    <Button className="min-[420px]:text-sm text-xs" asChild>
      <Link href={"/dashboard/subscription"}>
        {lockedTitle ?? t("upgrade")} <Lock className="w-3! h-3!" />
      </Link>
    </Button>
  );
};
