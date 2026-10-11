"use client";

import { ShortnUIProvider } from "@shortn/ui";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

// Shared controls follow the same locale as the dashboard.
export function UIProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <ShortnUIProvider
      locale={locale === "pt" || locale === "es" ? locale : "en"}
    >
      {children}
    </ShortnUIProvider>
  );
}
