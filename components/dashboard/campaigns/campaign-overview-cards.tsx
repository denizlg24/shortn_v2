"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MousePointerClick,
  Link2,
  Megaphone,
  Share2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignStats } from "@/app/actions/linkActions";
import { useTranslations } from "next-intl";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  className?: string;
  accentColor?: string;
}

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  className,
  accentColor = "from-chart-1/10 to-transparent",
}: StatCardProps) => {
  return (
    <Card
      className={cn(
        "p-5 flex flex-col gap-4 relative overflow-hidden group transition-all duration-300 hover:shadow-md",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          accentColor,
        )}
      />
      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-300">
          {icon}
        </div>
      </div>
      {trend && trendValue && (
        <div className="flex items-center gap-1.5 relative z-10">
          {trend === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : trend === "down" ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          ) : null}
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-emerald-500",
              trend === "down" && "text-red-500",
              trend === "neutral" && "text-muted-foreground",
            )}
          >
            {trendValue}
          </span>
        </div>
      )}
    </Card>
  );
};

const StatCardSkeleton = () => (
  <Card className="p-5 flex flex-col gap-4">
    <div className="flex items-start justify-between">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-10 w-10 rounded-lg" />
    </div>
  </Card>
);

export const CampaignOverviewCards = ({
  stats,
  loading,
}: {
  stats?: CampaignStats;
  loading?: boolean;
}) => {
  const t = useTranslations("campaign-overview");

  if (loading || !stats) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const topSource = stats.utmBreakdown.sources[0];
  const topMedium = stats.utmBreakdown.mediums[0];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <StatCard
        title={t("total-clicks")}
        value={stats.totalClicks}
        subtitle={t("campaign-engagements")}
        icon={<MousePointerClick className="w-5 h-5" />}
        accentColor="from-chart-1/10 to-transparent"
      />
      <StatCard
        title={t("active-links")}
        value={stats.uniqueLinks}
        subtitle={t("linked-to-campaign")}
        icon={<Link2 className="w-5 h-5" />}
        accentColor="from-chart-2/10 to-transparent"
      />
      <StatCard
        title={t("top-source")}
        value={topSource?.name || t("na")}
        subtitle={
          topSource
            ? t("clicks-count", { count: topSource.clicks })
            : t("no-data")
        }
        icon={<Megaphone className="w-5 h-5" />}
        accentColor="from-chart-3/10 to-transparent"
      />
      <StatCard
        title={t("top-medium")}
        value={topMedium?.name || t("na")}
        subtitle={
          topMedium
            ? t("clicks-count", { count: topMedium.clicks })
            : t("no-data")
        }
        icon={<Share2 className="w-5 h-5" />}
        accentColor="from-chart-4/10 to-transparent"
      />
    </div>
  );
};
