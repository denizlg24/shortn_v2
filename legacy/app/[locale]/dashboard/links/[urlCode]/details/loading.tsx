import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <main className="flex flex-col items-center w-full mx-auto md:gap-0 gap-2 bg-accent px-4 sm:pt-14! pt-6! pb-16">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-6 gap-6">
        <div className="w-full col-span-full flex flex-col gap-4">
          <Button variant={"link"} asChild>
            <Link className="font-semibold mr-auto" href={`/dashboard/links`}>
              <ChevronLeft />
              {t("link-details-back")}
            </Link>
          </Button>
          <Skeleton className="w-full md:h-42 sm:h-[203px] h-[215px] bg-background" />
          <Skeleton className="w-full md:h-[236px] sm:h-[268px] h-[528px] bg-background" />
          <Skeleton className="w-full sm:h-[397px] h-[412px] bg-background" />
        </div>
      </div>
    </main>
  );
}
