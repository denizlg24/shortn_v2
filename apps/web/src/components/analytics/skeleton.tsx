"use client";

import { Skeleton } from "@shortn/ui";
import { PageHeader } from "../shell/page-header";

export function StatStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-hidden
      className="grid auto-cols-fr grid-flow-col divide-x divide-line max-sm:grid-flow-row max-sm:grid-cols-2 max-sm:divide-x-0"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 px-5 py-1 first:pl-0 max-sm:px-0 max-sm:py-2.5"
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function AnalyticsSkeleton({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} className="flex-wrap gap-y-2 py-2.5">
        <Skeleton className="ml-auto h-8 w-72 rounded-control max-sm:ml-0 max-sm:w-full" />
      </PageHeader>
      <div aria-busy className="flex flex-col gap-8 px-gutter pt-6 pb-10">
        <StatStripSkeleton />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-56 rounded-control" />
          </div>
          <Skeleton className="h-60 w-full rounded-control" />
        </div>
      </div>
    </>
  );
}
