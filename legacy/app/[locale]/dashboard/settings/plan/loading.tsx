import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        {t("settings-plan-title")}
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        {t("settings-plan-subtitle")}
      </h2>
      <Separator className="my-4" />
      <div className="max-w-xl flex flex-col gap-4 w-full my-4">
        <div className="w-full flex flex-col gap-2">
          <Skeleton className="h-[350px] w-full  bg-muted-foreground/35!" />
        </div>
        <div className="w-full flex flex-col gap-2">
          <Skeleton className="h-[150px] w-full  bg-muted-foreground/35!" />
        </div>
      </div>
    </div>
  );
}
