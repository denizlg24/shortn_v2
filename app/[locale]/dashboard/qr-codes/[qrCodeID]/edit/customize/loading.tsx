import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full flex flex-row items-start justify-between gap-4 col-span-full">
          <div className="w-full flex flex-col gap-6 items-start">
            <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
              Customize your QR Code
            </h1>
            <div className="rounded bg-background lg:p-6 md:p-4 p-3 w-full flex flex-col gap-4">
              <div className="flex flex-col gap-2 items-start">
                <h1 className="lg:text-2xl md:text-xl sm:text-lg text-base font-bold">
                  Select styles
                </h1>
              </div>
            </div>
            <Skeleton className="w-full h-[400px]" />
          </div>
          <div className="w-full max-w-xs lg:flex hidden flex-col gap-4 items-center text-center">
            <p className="font-semibold text-muted-foreground lg:text-lg text-base">
              Preview
            </p>
            <Skeleton className="w-full h-auto max-w-52 aspect-square bg-background p-4 flex flex-col" />
            <p className="text-xs text-muted-foreground">
              This code is preview only, so don&apos;t copy it just yet.
              <br /> Your code will be generated once you finish creating it.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
