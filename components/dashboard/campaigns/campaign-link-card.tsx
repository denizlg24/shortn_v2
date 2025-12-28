"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getShortUrl } from "@/lib/utils";
import { TUrl } from "@/models/url/UrlV3";
import { ChartNoAxesColumn, Copy, CopyCheck, ExternalLink } from "lucide-react";
import { useState } from "react";

export const CampaignLinkCard = ({
  link,
  clicks,
}: {
  link: TUrl;
  clicks?: number;
}) => {
  const shortUrl = getShortUrl(link.urlCode);
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shortUrl);
    setJustCopied(true);
    setTimeout(() => {
      setJustCopied(false);
    }, 1000);
  };

  return (
    <div className="py-3 px-4 rounded bg-muted shadow-sm w-full flex flex-row items-center justify-between gap-4 hover:shadow transition-shadow">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <Link
          href={`/dashboard/links/${link.urlCode}/details`}
          className="font-semibold text-sm hover:underline underline-offset-2 truncate"
        >
          {link.title}
        </Link>
        <div className="flex flex-row items-center gap-2">
          <Link
            prefetch={false}
            target="_blank"
            href={shortUrl}
            className="text-xs text-blue-500 hover:underline truncate"
          >
            {shortUrl.split("://")[1]}
          </Link>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Copy short URL"
          >
            {justCopied ? (
              <CopyCheck className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-row items-center gap-3 shrink-0">
        {clicks !== undefined && (
          <div className="flex flex-row items-center gap-1 text-muted-foreground">
            <ChartNoAxesColumn className="w-4 h-4" />
            <span className="text-xs font-medium">
              {clicks} {clicks === 1 ? "click" : "clicks"}
            </span>
          </div>
        )}
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Link href={`/dashboard/links/${link.urlCode}/details`}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            View
          </Link>
        </Button>
      </div>
    </div>
  );
};
