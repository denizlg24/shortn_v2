import { Skeleton } from "@shortn/ui";

// Shapes match the loaded pages so nothing jumps when they stream in (12:
// skeletons, never spinners, on page loads).

function HeadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 pb-8">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
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
    <div aria-busy className="flex flex-col">
      <HeadingSkeleton />
      {Array.from({ length: sections }, (_, index) => (
        <div
          key={index}
          className="flex max-w-140 flex-col gap-5 border-t border-line py-8"
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
    </div>
  );
}

export function MembersSkeleton() {
  return (
    <div aria-busy className="flex flex-col">
      <HeadingSkeleton />
      <div className="flex max-w-140 flex-col gap-4 border-t border-line py-8">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded-control" />
          <Skeleton className="h-8 w-28 rounded-control" />
          <Skeleton className="h-8 w-24 rounded-control" />
        </div>
      </div>
      <div className="flex flex-col border-t border-line pt-8">
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
    </div>
  );
}

export function BillingSkeleton() {
  return (
    <div aria-busy className="flex flex-col">
      <HeadingSkeleton />
      <div className="flex flex-col gap-3 border-t border-line py-8">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 border-t border-line py-8 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-1 w-full rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-8">
        <Skeleton className="mb-2 h-5 w-20" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
