"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  Hash,
  Megaphone,
  Share2,
  Tag,
  FileText,
  RotateCcw,
} from "lucide-react";
import { getUtmTreeData, UtmTreeNode } from "@/app/actions/linkActions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface CampaignUtmTreeProps {
  campaignId: string;
  campaignTitle: string;
  initialData?: UtmTreeNode[];
}

interface TreePath {
  source?: string;
  medium?: string;
  term?: string;
}

const levelIcons: Record<string, React.ReactNode> = {
  campaign: <Folder className="w-4 h-4" />,
  source: <Megaphone className="w-4 h-4" />,
  medium: <Share2 className="w-4 h-4" />,
  term: <Tag className="w-4 h-4" />,
  content: <FileText className="w-4 h-4" />,
};

const levelLabels: Record<string, string> = {
  source: "Sources",
  medium: "Mediums",
  term: "Terms",
  content: "Contents",
};

export const CampaignUtmTree = ({
  campaignId,
  campaignTitle,
  initialData,
}: CampaignUtmTreeProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UtmTreeNode[]>(initialData || []);
  const [currentLevel, setCurrentLevel] = useState<
    "source" | "medium" | "term" | "content"
  >("source");
  const [path, setPath] = useState<TreePath>({});
  const [breadcrumb, setBreadcrumb] = useState<
    Array<{ level: string; value: string }>
  >([{ level: "campaign", value: campaignTitle }]);

  const fetchTreeData = useCallback(
    async (newPath: TreePath) => {
      setLoading(true);
      try {
        const result = await getUtmTreeData({
          campaignId,
          path: newPath,
        });
        if (result.success && result.data) {
          setData(result.data);
          setCurrentLevel(result.level || "source");
          setBreadcrumb(result.breadcrumb || []);
        }
      } catch (error) {
        console.error("Failed to fetch tree data:", error);
      } finally {
        setLoading(false);
      }
    },
    [campaignId],
  );

  const handleNodeClick = (node: UtmTreeNode) => {
    if (!node.hasChildren) return;

    const newPath = { ...path };
    switch (currentLevel) {
      case "source":
        newPath.source = node.name;
        break;
      case "medium":
        newPath.medium = node.name;
        break;
      case "term":
        newPath.term = node.name;
        break;
    }
    setPath(newPath);
    fetchTreeData(newPath);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath: TreePath = {};
    for (let i = 1; i <= index; i++) {
      const crumb = breadcrumb[i];
      if (crumb?.level === "source") newPath.source = crumb.value;
      if (crumb?.level === "medium") newPath.medium = crumb.value;
      if (crumb?.level === "term") newPath.term = crumb.value;
    }
    setPath(newPath);
    fetchTreeData(newPath);
  };

  const resetToRoot = () => {
    setPath({});
    fetchTreeData({});
  };

  const totalClicks = data.reduce((sum, node) => sum + node.clicks, 0);

  return (
    <Card className="w-full">
      <div className="px-6 py-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">UTM Hierarchy</CardTitle>
            <CardDescription>
              Drill down into your campaign's UTM performance
            </CardDescription>
          </div>
          {breadcrumb.length > 1 && (
            <Button variant="outline" size="sm" onClick={resetToRoot}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset
            </Button>
          )}
        </div>

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {index < breadcrumb.length - 1 ? (
                    <BreadcrumbLink
                      onClick={() => handleBreadcrumbClick(index)}
                      className="cursor-pointer flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      {levelIcons[crumb.level]}
                      <span className="truncate max-w-[100px]">
                        {crumb.value}
                      </span>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                      {levelIcons[crumb.level]}
                      <span className="truncate max-w-[100px]">
                        {crumb.value}
                      </span>
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumb.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <CardContent className="px-6 py-0">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No data available</p>
            <p className="text-sm">
              Start tracking clicks with UTM parameters to see data here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-3 pb-2 border-b">
              <span className="font-medium uppercase tracking-wider">
                {levelLabels[currentLevel] || currentLevel}
              </span>
              <span className="font-medium uppercase tracking-wider">
                Clicks
              </span>
            </div>
            {data.map((node, index) => {
              const percentage =
                totalClicks > 0
                  ? Math.round((node.clicks / totalClicks) * 100)
                  : 0;

              return (
                <button
                  key={node.name + index}
                  onClick={() => handleNodeClick(node)}
                  disabled={!node.hasChildren}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 group relative overflow-hidden",
                    node.hasChildren
                      ? "hover:bg-muted/80 cursor-pointer"
                      : "cursor-default",
                  )}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/5 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                  <div className="flex items-center gap-3 relative z-10">
                    <div
                      className={cn(
                        "p-1.5 rounded-md transition-colors duration-200",
                        node.hasChildren
                          ? "bg-muted group-hover:bg-primary/10 group-hover:text-primary"
                          : "bg-muted/50 text-muted-foreground",
                      )}
                    >
                      {node.hasChildren ? (
                        <FolderOpen className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          node.name === "(empty)" &&
                            "text-muted-foreground italic",
                        )}
                      >
                        {node.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {percentage}% of total
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 relative z-10">
                    <span className="font-semibold tabular-nums">
                      {node.clicks.toLocaleString()}
                    </span>
                    {node.hasChildren && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
