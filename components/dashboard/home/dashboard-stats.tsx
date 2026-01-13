"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LinkIcon,
  QrCode,
  MousePointerClick,
  Scan,
  LockIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  locked?: boolean;
  className?: string;
  lockedText: string;
  upgradeText: string;
}

const StatsCard = ({
  title,
  value,
  icon,
  locked,
  className,
  lockedText,
  upgradeText,
}: StatsCardProps) => {
  if (locked) {
    return (
      <Card
        className={cn(
          "p-4 flex flex-col gap-3 relative overflow-hidden",
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="flex items-center gap-2">
          <LockIcon className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{lockedText}</p>
        </div>
        <Button size="sm" variant="outline" className="mt-2" asChild>
          <Link href="/dashboard/subscription">{upgradeText}</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </Card>
  );
};

export const DashboardStats = ({
  stats,
  loading,
  plan,
}: {
  stats?: {
    totalLinks: number;
    totalQRCodes: number;
    totalClicks: number;
    totalScans: number;
  };
  loading?: boolean;
  plan?: string;
}) => {
  const t = useTranslations("dashboard.stats");

  if (loading || !stats) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 col-span-full">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const isFree = !plan || plan === "free";

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 col-span-full">
      <StatsCard
        title={t("total-links")}
        value={stats.totalLinks}
        icon={<LinkIcon className="w-5 h-5" />}
        lockedText={t("upgrade-to-view")}
        upgradeText={t("upgrade-plan")}
      />
      <StatsCard
        title={t("total-qr-codes")}
        value={stats.totalQRCodes}
        icon={<QrCode className="w-5 h-5" />}
        lockedText={t("upgrade-to-view")}
        upgradeText={t("upgrade-plan")}
      />
      <StatsCard
        title={t("total-clicks")}
        value={stats.totalClicks}
        icon={<MousePointerClick className="w-5 h-5" />}
        locked={isFree}
        lockedText={t("upgrade-to-view")}
        upgradeText={t("upgrade-plan")}
      />
      <StatsCard
        title={t("total-scans")}
        value={stats.totalScans}
        icon={<Scan className="w-5 h-5" />}
        locked={isFree}
        lockedText={t("upgrade-to-view")}
        upgradeText={t("upgrade-plan")}
      />
    </div>
  );
};
