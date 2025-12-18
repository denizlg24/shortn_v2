"use client";

import { PaginationControls } from "@/components/ui/pagination-controls";
import { TUrl } from "@/models/url/UrlV3";
import { CampaignLinkCard } from "./campaign-link-card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LinkIcon } from "lucide-react";
import { AddLinkToCampaignDialog } from "./add-link-to-campaign-dialog";

export const CampaignLinkContainer = ({
  links,
  total,
  limit,
  clicksMap,
  campaignTitle,
}: {
  links: TUrl[];
  total: number;
  limit: number;
  clicksMap?: Record<string, number>;
  campaignTitle: string;
}) => {
  return (
    <div className="w-full flex flex-col gap-2">
      {links.length > 0 ? (
        <>
          {links.map((link) => (
            <CampaignLinkCard
              key={link._id as string}
              link={link}
              clicks={clicksMap?.[link.urlCode]}
            />
          ))}
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>No links yet</EmptyTitle>
            <EmptyDescription>
              You still haven&apos;t added any links to this campaign. Add links
              to this campaign to group your links and get aggregated campaign
              analytics.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddLinkToCampaignDialog campaignTitle={campaignTitle} />
          </EmptyContent>
        </Empty>
      )}
      {Math.ceil(total / limit) > 1 && (
        <div className="pt-2">
          <PaginationControls totalPages={Math.ceil(total / limit)} />
        </div>
      )}
    </div>
  );
};
