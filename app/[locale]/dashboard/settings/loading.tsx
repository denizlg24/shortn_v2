import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        Profile Details
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        Update your photo and personal details here.
      </h2>
      <Separator className="my-4" />
      <div className="flex flex-row items-stretch justify-start gap-4 w-full">
        <Skeleton className="h-auto! w-full! min-w-12! max-w-24! aspect-square rounded-lg! bg-muted-foreground!" />
        <div className="w-full grow h-full flex flex-col justify-between py-1">
          <Skeleton className="w-16 col-span-1 h-4 rounded bg-muted-foreground!" />
          <div className="flex flex-col gap-1 items-start w-full">
            <div className="flex flex-row items-center justify-start gap-2 w-full">
              <Skeleton className="w-28 h-6 bg-muted-foreground!" />
            </div>
            <Skeleton className="w-36 col-span-1 h-4 rounded bg-muted-foreground!" />
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start">
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
        </div>
        <div className="flex flex-col gap-1 w-full col-span-1">
          <Skeleton className="w-[25%] col-span-1 h-4 rounded bg-muted-foreground!" />
          <Skeleton className="w-full col-span-1 h-8 rounded bg-muted-foreground!" />
        </div>
      </div>
    </div>
  );
}
