"use client";

import { Skeleton } from "@shortn/ui";
import { useTranslations } from "next-intl";
import { PageHeader } from "../shell/page-header";

/** Matches the desk's header and grid cells so the swap doesn't shift. */
export function QrDeskSkeleton() {
  const t = useTranslations("qr");
  return (
    <>
      <PageHeader title={t("title")} className="flex-wrap gap-y-2 py-2.5">
        <Skeleton className="h-8 w-60 rounded-control max-md:hidden" />
        <Skeleton className="ml-auto h-8 w-48 rounded-control" />
      </PageHeader>
      <div aria-busy className="overflow-hidden">
        <ul className="-mr-px grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
          {Array.from({ length: 12 }, (_, index) => (
            <li
              key={index}
              className="flex flex-col gap-3 border-r border-b border-line px-4 pt-5 pb-3.5"
            >
              <Skeleton className="mx-auto size-30 rounded-chip" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function QrEditorSkeleton() {
  const t = useTranslations("qr");
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t("title")}>
        <Skeleton className="ml-auto h-8 w-44 rounded-control" />
      </PageHeader>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,42%)]">
        <div className="flex flex-col gap-4 px-gutter py-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full max-w-140 rounded-control" />
          <Skeleton className="h-8 w-full max-w-140 rounded-control" />
        </div>
        <div className="grid place-items-center border-line bg-bg-subtle py-8 max-lg:order-first lg:border-l">
          <Skeleton className="size-60 rounded-chip lg:size-75" />
        </div>
      </div>
    </div>
  );
}
