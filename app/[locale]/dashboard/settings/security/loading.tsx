import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("loading");
  return (
    <div className="w-full flex flex-col">
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        {t("settings-security-title")}
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        {t("settings-security-subtitle")}
      </h2>
      <Separator className="my-4" />
      <div className="grid sm:grid-cols-2 grid-cols-1 max-w-xl gap-x-8 gap-y-4 w-full my-4 items-start">
        <div className="col-span-1 w-full h-[58px] flex flex-col justify-between items-start">
          <Skeleton className="h-[14px] w-[55%]  bg-muted-foreground/35!" />
          <Skeleton className="h-[36px] w-full  bg-muted-foreground/35!" />
        </div>
        <div className="col-span-1 w-full h-[58px] flex flex-col justify-between items-start">
          <Skeleton className="h-[14px] w-[55%]  bg-muted-foreground/35!" />
          <Skeleton className="h-[36px] w-full  bg-muted-foreground/35!" />
        </div>
        <div className="col-span-1 w-full h-[58px] flex flex-col justify-between items-start">
          <Skeleton className="h-[14px] w-[55%]  bg-muted-foreground/35!" />
          <Skeleton className="h-[36px] w-full  bg-muted-foreground/35!" />
        </div>
      </div>
      <Separator className="my-4" />
      <h1 className="lg:text-xl md:text-lg sm:text-base text-sm font-semibold">
        {t("settings-security-access-title")}
      </h1>
      <h2 className="lg:text-base sm:text-sm text-xs text-muted-foreground">
        {t("settings-security-access-subtitle")}
      </h2>
      <Separator className="my-4" />
    </div>
  );
}
