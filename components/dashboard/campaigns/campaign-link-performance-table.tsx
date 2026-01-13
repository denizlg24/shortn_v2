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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, BASEURL } from "@/lib/utils";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Link2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle,
  Share2,
  Settings,
  MousePointerClick,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  FacebookShareButton,
  RedditShareButton,
  RedditIcon,
  TwitterShareButton,
  WhatsappShareButton,
  WhatsappIcon,
  EmailShareButton,
  EmailIcon,
  FacebookIcon,
  TwitterIcon,
} from "next-share";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface UtmLinkData {
  source?: string;
  medium?: string;
  term?: string;
  content?: string;
}

interface LinkPerformanceData {
  urlCode: string;
  title: string;
  clicks: number;
  utmLinks?: UtmLinkData[];
}

interface CampaignLinkPerformanceTableProps {
  links: LinkPerformanceData[];
  loading?: boolean;
  campaignId: string;
  campaignTitle: string;
}

type SortField = "title" | "clicks";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 5;

function buildUtmUrl(
  shortUrl: string,
  utm: UtmLinkData,
  campaignTitle: string,
): string {
  const params = new URLSearchParams();
  if (utm.source) params.set("utm_source", utm.source);
  if (utm.medium) params.set("utm_medium", utm.medium);
  params.set("utm_campaign", campaignTitle);
  if (utm.term) params.set("utm_term", utm.term);
  if (utm.content) params.set("utm_content", utm.content);

  if ([...params].length === 0) return shortUrl;
  const separator = shortUrl.includes("?") ? "&" : "?";
  return `${shortUrl}${separator}${params.toString()}`;
}

function getUtmLabel(utm: UtmLinkData): string {
  const parts: string[] = [];
  if (utm.source) parts.push(utm.source);
  if (utm.medium) parts.push(utm.medium);
  if (utm.term) parts.push(utm.term);
  if (utm.content) parts.push(utm.content);
  return parts.length > 0 ? parts.join(" / ") : "Default";
}

export function CampaignLinkPerformanceTable({
  links,
  loading,
  campaignId,
  campaignTitle,
}: CampaignLinkPerformanceTableProps) {
  const t = useTranslations("campaign-link-performance");
  const [sortField, setSortField] = useState<SortField>("clicks");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const toggleExpanded = (urlCode: string) => {
    setExpandedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(urlCode)) {
        next.delete(urlCode);
      } else {
        next.add(urlCode);
      }
      return next;
    });
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success(t("toast.copied"));
    setTimeout(() => setCopiedUrl(null), 1500);
  };

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

  const totalPages = Math.ceil(sortedLinks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedLinks = sortedLinks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

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
          <CardTitle className="text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
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
          <CardTitle className="text-lg">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <CardContent className="px-6 py-0">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Link2 className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">{t("no-links-title")}</p>
            <p className="text-sm">{t("no-links-description")}</p>
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
            <CardTitle className="text-lg">{t("title")}</CardTitle>
            <CardDescription>
              {t("summary", { links: links.length, clicks: totalClicks })}
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
              {t("link")}
              {renderSortIcon("title")}
            </button>
            <button
              onClick={() => handleSort("clicks")}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              {t("clicks")}
              {renderSortIcon("clicks")}
            </button>
            <span className="w-16 sm:w-24 text-center">{t("actions")}</span>
          </div>

          <div className="divide-y">
            {paginatedLinks.map((link) => {
              const percentage =
                totalClicks > 0
                  ? Math.round((link.clicks / totalClicks) * 100)
                  : 0;
              const isExpanded = expandedLinks.has(link.urlCode);
              const hasUtmLinks = (link.utmLinks?.length ?? 0) > 0;
              const shortUrl = `${BASEURL}/${link.urlCode}`;

              return (
                <div key={link.urlCode} className="flex flex-col">
                  <div
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
                          {shortUrl}
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {percentage}%
                        </Badge>
                        {hasUtmLinks && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {link.utmLinks?.length} UTM
                            {link.utmLinks?.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 relative z-10">
                      <span className="font-semibold tabular-nums flex items-center justify-end min-w-10 sm:min-w-[60px] text-right text-sm pr-3 border-r border-r-muted-foreground">
                        <MousePointerClick className="inline-flex mr-2 my-auto w-3 h-3 text-muted-foreground" />
                        {link.clicks.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 sm:gap-1 relative z-10 w-16 sm:w-24 justify-end">
                      {hasUtmLinks ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 transition-opacity"
                          onClick={() => toggleExpanded(link.urlCode)}
                        >
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-7 w-7 sm:h-8 sm:w-8 transition-opacity text-muted-foreground!"
                        >
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </Button>
                      )}
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
                          <Link2 className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {isExpanded && hasUtmLinks && (
                    <div className="px-3 sm:px-4 pb-3 pt-2 bg-muted/20 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("utm-tagged-links")}
                      </p>
                      <div className="space-y-2">
                        {link.utmLinks?.map((utm, utmIndex) => {
                          const utmUrl = buildUtmUrl(
                            shortUrl,
                            utm,
                            campaignTitle,
                          );
                          const utmLabel = getUtmLabel(utm);
                          const isCopied = copiedUrl === utmUrl;

                          return (
                            <div
                              key={utmIndex}
                              className="flex items-center gap-2 p-2 rounded-md bg-background border"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {utmLabel}
                                </p>
                                <code className="text-[10px] text-muted-foreground font-mono truncate block">
                                  {utmUrl
                                    .replace("https://", "")
                                    .replace("www.", "")}
                                </code>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleCopyUrl(utmUrl)}
                                      >
                                        {isCopied ? (
                                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {t("copy-link")}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>
                                        {t("share.title")}
                                      </DialogTitle>
                                      <DialogDescription>
                                        {t("share.description")}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="w-full grid grid-cols-5 gap-4">
                                      <FacebookShareButton
                                        url={utmUrl}
                                        quote={t("share.text")}
                                      >
                                        <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                                          <FacebookIcon size={32} round />
                                        </div>
                                      </FacebookShareButton>
                                      <RedditShareButton
                                        url={utmUrl}
                                        title={t("share.text")}
                                      >
                                        <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                                          <RedditIcon size={32} round />
                                        </div>
                                      </RedditShareButton>
                                      <TwitterShareButton
                                        url={utmUrl}
                                        title={t("share.text")}
                                      >
                                        <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                                          <TwitterIcon size={32} round />
                                        </div>
                                      </TwitterShareButton>
                                      <WhatsappShareButton
                                        url={utmUrl}
                                        title={t("share.text")}
                                        separator=" "
                                      >
                                        <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                                          <WhatsappIcon size={32} round />
                                        </div>
                                      </WhatsappShareButton>
                                      <EmailShareButton
                                        url={utmUrl}
                                        subject={t("share.email-subject")}
                                        body={t("share.email-body")}
                                      >
                                        <div className="col-span-1 w-full h-auto aspect-square border rounded flex items-center justify-center p-1 max-w-16 mx-auto">
                                          <EmailIcon size={32} round />
                                        </div>
                                      </EmailShareButton>
                                    </div>
                                    <Separator />
                                    <div className="relative w-full flex items-center">
                                      <Input
                                        value={utmUrl}
                                        readOnly
                                        className="w-full bg-background text-xs pr-16"
                                      />
                                      <Button
                                        onClick={() => handleCopyUrl(utmUrl)}
                                        variant="secondary"
                                        className="h-fit! py-1! px-2 text-xs font-bold z-10 hover:cursor-pointer absolute right-2"
                                      >
                                        {isCopied ? t("copied") : t("copy")}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="px-3 sm:px-4 py-2 bg-muted/50 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("showing", {
                  start: startIndex + 1,
                  end: Math.min(
                    startIndex + ITEMS_PER_PAGE,
                    sortedLinks.length,
                  ),
                  total: sortedLinks.length,
                })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="px-3 sm:px-4 py-2 bg-muted/30 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ChevronDown className="w-3 h-3" />
              <span>{t("hint.expand-utm")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Settings className="w-3 h-3" />
              <span>{t("hint.edit-utm")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              <span>{t("hint.view-details")}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
