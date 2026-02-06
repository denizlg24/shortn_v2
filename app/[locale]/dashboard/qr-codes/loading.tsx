import { SortingControls } from "@/components/dashboard/links/sorting-controls";
import { QRCodesFilterBar } from "@/components/dashboard/qr-codes/qr-codes-filter-bar";
import { Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
        <h1 className="col-span-full lg:text-3xl md:text-2xl sm:text-xl text-lg font-bold">
          {t("qr-codes-title")}
        </h1>
        <QRCodesFilterBar />
        <SortingControls
          label={t("qr-codes-sort")}
          className="-mt-3 col-span-full"
        />
        <div className="w-full flex flex-row items-center justify-start font-semibold md:text-base text-sm gap-1">
          <Loader2 className="animate-spin h-4 w-4 aspect-square" />
          <p>{t("qr-codes-loading")}</p>
        </div>
      </div>
    </main>
  );
}
