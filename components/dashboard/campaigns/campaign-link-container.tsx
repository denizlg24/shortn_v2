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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("campaign-link-container");

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
            <EmptyTitle>{t("no-links-title")}</EmptyTitle>
            <EmptyDescription>{t("no-links-description")}</EmptyDescription>
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
