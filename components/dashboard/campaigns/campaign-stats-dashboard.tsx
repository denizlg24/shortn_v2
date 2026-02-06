"use client";

import { useState, useEffect, useCallback } from "react";
import { CampaignOverviewCards } from "./campaign-overview-cards";
import { CampaignTimeChart } from "./campaign-time-chart";
import { CampaignUtmTree } from "./campaign-utm-tree";
import { CampaignLinkPerformanceTable } from "./campaign-link-performance-table";
import { CampaignUtmDefaultsEditor } from "./campaign-utm-defaults-editor";
import { CampaignExportDialog } from "./campaign-export-dialog";
import { AddLinkToCampaignDialog } from "./add-link-to-campaign-dialog";
import { DeleteCampaignButton } from "@/app/[locale]/dashboard/campaigns/[id]/delete-campaign-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCampaignStats,
  getUtmTreeData,
  CampaignStats,
  UtmTreeNode,
} from "@/app/actions/linkActions";
import {
  Link2,
  BarChart3,
  GitBranch,
  Download,
  Settings,
  Plus,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { IUtmDefaults } from "@/models/url/Campaigns";
import { useTranslations } from "next-intl";

interface CampaignStatsDashboardProps {
  campaignId: string;
  campaignTitle: string;
  campaignDescription?: string;
  campaignUtmDefaults?: IUtmDefaults;
  linksCount: number;
  createdAt: string;
}

export function CampaignStatsDashboard({
  campaignId,
  campaignTitle,
  campaignDescription,
  campaignUtmDefaults,
  linksCount,
  createdAt,
}: CampaignStatsDashboardProps) {
  const t = useTranslations("campaign-stats-dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [utmTreeData, setUtmTreeData] = useState<UtmTreeNode[]>([]);
  const [description, setDescription] = useState(campaignDescription || "");
  const [utmDefaults, setUtmDefaults] = useState(campaignUtmDefaults);
  const [currentLinksCount, setCurrentLinksCount] = useState(linksCount);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResult, treeResult] = await Promise.all([
        getCampaignStats({ campaignId }),
        getUtmTreeData({ campaignId, path: {} }),
      ]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
      if (treeResult.success && treeResult.data) {
        setUtmTreeData(treeResult.data);
      }
    } catch (error) {
      console.error("Failed to fetch campaign data:", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const linkPerformanceData =
    stats?.topPerformingLinks.map((link) => ({
      urlCode: link.urlCode,
      title: link.title,
      clicks: link.clicks,
      utmLinks: link.utmLinks,
    })) || [];

  const handleLinkAdded = useCallback(
    (link: { urlCode: string; title: string }) => {
      setCurrentLinksCount((prev) => prev + 1);

      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          uniqueLinks: prev.uniqueLinks + 1,
          topPerformingLinks: [
            ...prev.topPerformingLinks,
            { urlCode: link.urlCode, title: link.title, clicks: 0 },
          ],
        };
      });
    },
    [],
  );

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-4 sm:p-6 rounded-xl bg-background shadow">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold truncate">{campaignTitle}</h1>
            <Badge variant="secondary" className="shrink-0">
              {t("links-count", { count: currentLinksCount })}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mb-2">{description}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {t("created", {
                date: format(new Date(createdAt), "MMM d, yyyy"),
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <AddLinkToCampaignDialog
            campaignTitle={campaignTitle}
            onLinkAdded={handleLinkAdded}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                {t("add-link")}
              </Button>
            }
          />
          <CampaignExportDialog
            campaignId={campaignId}
            campaignTitle={campaignTitle}
            stats={stats || undefined}
            trigger={
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" />
                {t("export")}
              </Button>
            }
          />
          <DeleteCampaignButton title={campaignTitle} className="h-9" />
        </div>
      </div>

      <CampaignOverviewCards stats={stats || undefined} loading={loading} />

      <Tabs defaultValue="links" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
          <TabsTrigger value="links" className="gap-1.5">
            <Link2 className="w-4 h-4 hidden sm:block" />
            {t("tabs.links")}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="w-4 h-4 hidden sm:block" />
            {t("tabs.analytics")}
          </TabsTrigger>
          <TabsTrigger value="utm-tree" className="gap-1.5">
            <GitBranch className="w-4 h-4 hidden sm:block" />
            {t("tabs.utm-tree")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="w-4 h-4 hidden sm:block" />
            {t("tabs.settings")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="links" className="mt-4">
          <CampaignLinkPerformanceTable
            links={linkPerformanceData}
            loading={loading}
            campaignId={campaignId}
            campaignTitle={campaignTitle}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-6">
          <CampaignTimeChart data={stats?.timeline || []} loading={loading} />

          {stats && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-background shadow">
                <h3 className="font-semibold pb-2 mb-4 border-b">
                  {t("top-countries")}
                </h3>
                {stats.geographic.length > 0 ? (
                  <div className="space-y-3">
                    {stats.geographic.slice(0, 5).map((item, index) => (
                      <div
                        key={item.country}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4">
                            {index + 1}
                          </span>
                          <span className="font-medium">{item.country}</span>
                        </div>
                        <span className="text-sm tabular-nums">
                          {item.clicks.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("no-geographic-data")}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-background shadow">
                <h3 className="font-semibold pb-2 mb-4 border-b">
                  {t("device-breakdown")}
                </h3>
                {stats.devices.length > 0 ? (
                  <div className="space-y-3">
                    {stats.devices.map((item) => {
                      const total = stats.devices.reduce(
                        (sum, d) => sum + d.clicks,
                        0,
                      );
                      const percentage = Math.round(
                        (item.clicks / total) * 100,
                      );
                      return (
                        <div key={item.device} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{item.device}</span>
                            <span className="tabular-nums">{percentage}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("no-device-data")}
                  </p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="utm-tree" className="mt-4">
          <CampaignUtmTree
            campaignId={campaignId}
            campaignTitle={campaignTitle}
            initialData={utmTreeData}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <CampaignUtmDefaultsEditor
            campaignId={campaignId}
            initialDescription={description}
            initialDefaults={utmDefaults}
            onUpdate={(data) => {
              if (data.description !== undefined) {
                setDescription(data.description);
              }
              if (data.utmDefaults) {
                setUtmDefaults(data.utmDefaults);
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
