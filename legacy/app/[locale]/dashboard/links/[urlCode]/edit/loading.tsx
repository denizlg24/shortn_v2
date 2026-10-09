import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-4xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full flex flex-col gap-6 items-start col-span-full">
          <h1 className="font-bold lg:text-3xl md:text-2xl sm:text-xl text-lg">
            {t("link-edit-title")}
          </h1>
          <Skeleton className="w-full h-[250px]" />
        </div>
      </div>
    </main>
  );
}
