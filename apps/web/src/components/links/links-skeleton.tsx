"use client";

import { LinksTable, Skeleton, type LinkRow } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "@/lib/use-media-query";
import { PageHeader } from "../shell/page-header";

const noLinks: LinkRow[] = [];
const ignoreOpen = () => {};

/** Matches the real desk's header and 44px rows so the swap doesn't shift. */
export function LinksDeskSkeleton() {
  const t = useTranslations("links");
  const desktop = useMediaQuery("(min-width: 1200px)");
  return (
    <>
      <PageHeader title={t("title")} className="flex-wrap gap-y-2 py-2.5">
        <Skeleton className="h-8 w-60 rounded-control max-md:hidden" />
        <Skeleton className="ml-auto h-8 w-32 rounded-control max-sm:w-8" />
      </PageHeader>
      <LinksTable
        label={t("title")}
        links={noLinks}
        status="loading"
        compactColumns={!desktop}
        onOpen={ignoreOpen}
      />
    </>
  );
}
