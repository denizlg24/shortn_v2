"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getShortUrl } from "@/lib/utils";
import { TUrl } from "@/models/url/UrlV3";
import { TQRCode } from "@/models/url/QRCodeV2";
import {
  LinkIcon,
  QrCode,
  ExternalLink,
  TrendingUp,
  Calendar,
  MousePointerClick,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface RecentActivityProps {
  recentLinks?: TUrl[];
  recentQRCodes?: TQRCode[];
  topLink?: TUrl;
  topQRCode?: TQRCode;
  loading?: boolean;
  plan?: string;
  className?: string;
}

const formatDate = (date: Date | string) => {
  return format(new Date(date), "MMM d, yyyy");
};

const LinkItem = ({
  link,
  showClicks,
  clicksLabel,
}: {
  link: TUrl;
  showClicks: boolean;
  clicksLabel: string;
}) => {
  const shortUrl = getShortUrl(link.urlCode);
  return (
    <Link
      href={`/dashboard/links/${link.urlCode}/details`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-1 text-muted-foreground shrink-0">
          <LinkIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {link.title || "Untitled"}
          </p>
          <p className="text-xs text-muted-foreground truncate">{shortUrl}</p>
          <div className="flex items-center gap-2 mt-1">
            {showClicks && (
              <Badge variant="outline" className="text-xs">
                <MousePointerClick className="w-3 h-3" />
                {link.clicks?.total || 0} {clicksLabel}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(link.date)}
            </span>
          </div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
};

const QRCodeItem = ({
  qrCode,
  showClicks,
  scansLabel,
}: {
  qrCode: TQRCode;
  showClicks: boolean;
  scansLabel: string;
}) => {
  return (
    <Link
      href={`/dashboard/qr-codes/${qrCode.qrCodeId}`}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="mt-1 text-muted-foreground shrink-0">
          <QrCode className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {qrCode.title || "Untitled QR Code"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {qrCode.longUrl}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {showClicks && (
              <Badge variant="outline" className="text-xs">
                <MousePointerClick className="w-3 h-3" />
                {qrCode.clicks?.total || 0} {scansLabel}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(qrCode.date)}
            </span>
          </div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 p-3">
        <Skeleton className="w-4 h-4 rounded" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    ))}
  </div>
);

export const RecentActivity = ({
  recentLinks,
  recentQRCodes,
  topLink,
  topQRCode,
  loading,
  plan,
  className,
}: RecentActivityProps) => {
  const t = useTranslations("recent-activity");
  const canSeeClicks = Boolean(plan && plan !== "free");

  if (loading) {
    return (
      <>
        <Card className={cn("p-4 flex flex-col gap-4", className)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">{t("recent-links")}</h2>
            </div>
          </div>
          <LoadingSkeleton />
        </Card>

        <Card className={cn("p-4 flex flex-col gap-4", className)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">{t("top-performers")}</h2>
            </div>
          </div>
          <LoadingSkeleton />
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className={cn("p-4 flex flex-col gap-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">{t("recent-links")}</h2>
          </div>
          {recentLinks && recentLinks.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/links">
                {t("view-all")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>

        {!recentLinks || recentLinks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">{t("no-links")}</p>
            <p className="text-xs mt-1">{t("get-started")}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentLinks.slice(0, 3).map((link) => (
              <LinkItem
                key={link._id?.toString()}
                link={link}
                showClicks={canSeeClicks}
                clicksLabel={t("clicks")}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className={cn("p-4 flex flex-col gap-4", className)}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">{t("top-performers")}</h2>
        </div>

        {(!topLink || topLink.clicks?.total === 0) &&
        (!topQRCode || topQRCode.clicks?.total === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">{t("no-activity")}</p>
            <p className="text-xs mt-1">{t("share-links")}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {topLink && topLink.clicks?.total > 0 && (
              <LinkItem
                link={topLink}
                showClicks={canSeeClicks}
                clicksLabel={t("clicks")}
              />
            )}
            {topQRCode && topQRCode.clicks?.total > 0 && (
              <QRCodeItem
                qrCode={topQRCode}
                showClicks={canSeeClicks}
                scansLabel={t("scans")}
              />
            )}
          </div>
        )}
      </Card>

      {recentQRCodes && recentQRCodes.length > 0 && (
        <Card className={cn("p-4 flex flex-col gap-4", className)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-lg">{t("recent-qr-codes")}</h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/qr-codes">
                {t("view-all")}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          <div className="space-y-1">
            {recentQRCodes.slice(0, 3).map((qrCode) => (
              <QRCodeItem
                key={qrCode._id?.toString()}
                qrCode={qrCode}
                showClicks={canSeeClicks}
                scansLabel={t("scans")}
              />
            ))}
          </div>
        </Card>
      )}
    </>
  );
};
