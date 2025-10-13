import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Billing Details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Update your billing details here.
      </h2>
      <Separator className="my-4" />
      <div className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start">
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground/35!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground/35!" />
        </div>
      </div>
      <Separator className="my-4" />
      <div className="w-full grid grid-cols-2 max-w-xl gap-x-4 gap-y-6">
        <Skeleton className="h-[131px] col-span-1 rounded bg-muted-foreground/35!" />
        <Skeleton className="h-[131px] col-span-1 rounded bg-muted-foreground/35!" />
        <Skeleton className="col-span-full w-full h-[131px] rounded bg-muted-foreground/35!" />
      </div>
    </div>
  );
}
