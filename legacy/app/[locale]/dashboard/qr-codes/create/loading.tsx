import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full flex flex-row items-start justify-between gap-4 col-span-full">
          <div className="w-full flex flex-col gap-6 items-start">
            <div className="flex flex-col gap-1 w-full items-start">
              <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
                {t("qr-code-create-title")}
              </h1>
            </div>
            <Skeleton className="w-full h-[300px]" />
          </div>
          <Skeleton className="w-full max-w-xs lg:flex hidden flex-col gap-4 items-center text-center" />
        </div>
      </div>
    </main>
  );
}
