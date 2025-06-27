import { useLocale } from "next-intl";
import { LocaleSwitcherSelect } from "./local-switcher-select";
import { Suspense } from "react";
import { Skeleton } from "./skeleton";

export const LocaleSwitcher = () => {
  const locale = useLocale();
  return (
    <Suspense fallback={<Skeleton className="w-8 h-8 rounded-full" />}>
      <LocaleSwitcherSelect defaultValue={locale} />
    </Suspense>
  );
};
