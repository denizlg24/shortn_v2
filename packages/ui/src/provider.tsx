import type { ReactNode } from "react";
import { TooltipProvider } from "./components/tooltip";
import { UILocaleProvider } from "./i18n/provider";
import type { Locale } from "./i18n/strings";

export function ShortnUIProvider({
  locale = "en",
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  return (
    <UILocaleProvider locale={locale}>
      <TooltipProvider>{children}</TooltipProvider>
    </UILocaleProvider>
  );
}
