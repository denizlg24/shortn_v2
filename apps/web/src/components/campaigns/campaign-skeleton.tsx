"use client";

import { Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { StatStripSkeleton } from "../analytics/skeleton";
import { PageHeader } from "../shell/page-header";

export function CampaignsListSkeleton() {
  const t = useTranslations("campaigns");
  return (
    <>
      <PageHeader title={t("title")}>
        <Skeleton className="ml-auto h-8 w-36 rounded-control max-sm:w-8" />
      </PageHeader>
      <div aria-busy>
        <div className="h-header-row border-b border-line bg-bg-subtle" />
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex h-row items-center gap-6 border-b border-line px-gutter"
          >
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="ml-auto h-3.5 w-10" />
            <Skeleton className="h-3.5 w-20 max-sm:hidden" />
          </div>
        ))}
      </div>
    </>
  );
}

export function CampaignPageSkeleton() {
  const t = useTranslations("campaigns");
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("title")}>
        <Skeleton className="ml-auto h-8 w-28 rounded-control" />
      </PageHeader>
      <div className="flex flex-col gap-2 px-gutter pt-4 pb-3">
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="flex h-10 items-center gap-5 border-b border-line px-gutter">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
      <div className="flex flex-col gap-8 px-gutter pt-6">
        <StatStripSkeleton />
        <Skeleton className="h-60 w-full rounded-control" />
      </div>
    </div>
  );
}
