"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Link2,
  Settings,
  LinkIcon,
} from "lucide-react";
import { BASEURL } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

interface LinkPerformanceData {
  urlCode: string;
  title: string;
  clicks: number;
}

interface CampaignLinkPerformanceTableProps {
  links: LinkPerformanceData[];
  loading?: boolean;
  campaignId: string;
  campaignTitle: string;
}

type SortField = "title" | "clicks";
type SortDirection = "asc" | "desc";

export function CampaignLinkPerformanceTable({
  links,
  loading,
  campaignId,
  campaignTitle: _campaignTitle,
}: CampaignLinkPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedLinks = [...links].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    if (sortField === "clicks") {
      return (a.clicks - b.clicks) * multiplier;
    }
    return a.title.localeCompare(b.title) * multiplier;
  });

  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5" />
    );
  };

  if (loading) {
    return (
      <Card className="w-full">
        <div className="px-6 py-0">
          <CardTitle className="text-lg">Link Performance</CardTitle>
          <CardDescription>
            Click performance by individual link
          </CardDescription>
        </div>
        <CardContent className="px-6 py-0">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (links.length === 0) {
    return (
      <Card className="w-full">
        <div className="px-6 py-0">
          <CardTitle className="text-lg">Link Performance</CardTitle>
          <CardDescription>
            Click performance by individual link
          </CardDescription>
        </div>
        <CardContent className="px-6 py-0">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Link2 className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">No links in this campaign</p>
            <p className="text-sm">Add links to start tracking performance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <div className="px-6 py-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Link Performance</CardTitle>
            <CardDescription>
              {links.length} link{links.length !== 1 ? "s" : ""} with{" "}
              {totalClicks.toLocaleString()} total click
              {totalClicks !== 1 ? "s" : ""}
            </CardDescription>
          </div>
        </div>
      </div>

      <CardContent className="px-6 py-0">
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 px-3 sm:px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
            <button
              onClick={() => handleSort("title")}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left"
            >
              Link
              {renderSortIcon("title")}
            </button>
            <button
              onClick={() => handleSort("clicks")}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              Clicks
              {renderSortIcon("clicks")}
            </button>
            <span className="w-16 sm:w-24 text-center">Actions</span>
          </div>

          <div className="divide-y">
            {sortedLinks.map((link) => {
              const percentage =
                totalClicks > 0
                  ? Math.round((link.clicks / totalClicks) * 100)
                  : 0;

              return (
                <div
                  key={link.urlCode}
                  className={cn(
                    "grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 px-3 sm:px-4 py-3 items-center group hover:bg-muted/30 transition-colors relative",
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/5 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="flex flex-col gap-1 relative z-10 min-w-0 overflow-hidden">
                    <Link
                      href={`/dashboard/campaigns/${campaignId}/links/${link.urlCode}`}
                      className="font-medium text-sm truncate hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {link.title}
                    </Link>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-muted-foreground">
                      <span className="truncate font-mono text-[11px] sm:text-xs">
                        {BASEURL}/{link.urlCode}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {percentage}%
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 relative z-10">
                    <span className="font-semibold tabular-nums min-w-10 sm:min-w-[60px] text-right text-sm">
                      {link.clicks.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 relative z-10 w-16 sm:w-24 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 transition-opacity"
                      asChild
                    >
                      <Link
                        href={`/dashboard/campaigns/${campaignId}/links/${link.urlCode}`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 transition-opacity"
                      asChild
                    >
                      <Link href={`/dashboard/links/${link.urlCode}/details`}>
                        <LinkIcon className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
