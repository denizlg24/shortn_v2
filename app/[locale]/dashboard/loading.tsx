import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-12! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4 pb-6">
          <div className="w-full flex flex-row items-center justify-start font-semibold md:text-base text-sm gap-1">
            <Loader2 className="animate-spin h-4 w-4 aspect-square" />
            <p>Loading...</p>
          </div>
        </div>
      </div>
    </main>
  );
}
