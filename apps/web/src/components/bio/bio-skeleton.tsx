"use client";

import { Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { PageHeader } from "../shell/page-header";

export function BioListSkeleton() {
  const t = useTranslations("bio");
  return (
    <>
      <PageHeader title={t("title")}>
        <Skeleton className="ml-auto h-8 w-36 rounded-control max-sm:w-8" />
      </PageHeader>
      <div aria-busy>
        <div className="h-header-row border-b border-line bg-bg-subtle" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-13 items-center gap-3 border-b border-line px-gutter"
          >
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="ml-auto h-3.5 w-48 max-md:hidden" />
          </div>
        ))}
      </div>
    </>
  );
}

export function BioEditorSkeleton() {
  const t = useTranslations("bio");
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("title")}>
        <Skeleton className="ml-auto h-7 w-56 rounded-control max-md:w-20" />
      </PageHeader>
      <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,40%)]">
        <div className="flex flex-1 flex-col gap-4 px-gutter py-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full max-w-140 rounded-control" />
          <Skeleton className="h-20 w-full max-w-140 rounded-control" />
        </div>
        <div className="grid place-items-start justify-center border-line bg-bg-subtle py-6 max-lg:hidden lg:border-l">
          <Skeleton className="h-[min(720px,calc(100dvh-180px))] w-[360px] rounded-[28px]" />
        </div>
      </div>
    </div>
  );
}
