import { Skeleton } from "@shortn/ui";
import type { ReactNode } from "react";
import { Page } from "@/components/page/page";

// Shapes match the loaded pages so nothing jumps when they stream in (12:
// skeletons, never spinners, on page loads).

function SettingsSkeleton({ children }: { children: ReactNode }) {
  return (
    <Page
      crumbs={[{ label: <Skeleton className="h-4 w-36" /> }]}
      title={<Skeleton className="h-6 w-32" />}
      description={<Skeleton className="h-4 w-72 max-w-full" />}
    >
      <div aria-busy className="flex flex-col">
        {children}
      </div>
    </Page>
  );
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-full rounded-control" />
    </div>
  );
}

export function FormPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <SettingsSkeleton>
      {Array.from({ length: sections }, (_, index) => (
        <div
          key={index}
          className="flex max-w-140 flex-col gap-5 border-b border-line py-6 first:pt-0 last:border-b-0"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <FieldSkeleton />
          {index === 0 ? <FieldSkeleton /> : null}
          <Skeleton className="h-8 w-20 rounded-control" />
        </div>
      ))}
    </SettingsSkeleton>
  );
}

export function MembersSkeleton() {
  return (
    <SettingsSkeleton>
      <div className="flex max-w-140 flex-col gap-4 border-b border-line py-6 first:pt-0 last:border-b-0">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-control" />
          <Skeleton className="h-8 w-28 rounded-control" />
          <Skeleton className="h-8 w-24 rounded-control" />
        </div>
      </div>
      <div className="flex flex-col pt-6">
        <Skeleton className="mb-4 h-5 w-28" />
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="flex h-14 items-center gap-3 border-b border-line"
          >
            <Skeleton className="size-6 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-24 rounded-control" />
          </div>
        ))}
      </div>
    </SettingsSkeleton>
  );
}

export function BillingSkeleton() {
  return (
    <SettingsSkeleton>
      <div className="flex flex-col gap-3 border-b border-line py-6 first:pt-0 last:border-b-0">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 border-b border-line py-6 first:pt-0 last:border-b-0 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-1 w-full rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-6">
        <Skeleton className="mb-2 h-5 w-20" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    </SettingsSkeleton>
  );
}
