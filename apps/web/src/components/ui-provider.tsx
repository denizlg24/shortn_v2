"use client";

import { ShortnUIProvider } from "@shortn/ui";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";

// @shortn/ui ships en and pt strings only; Spanish falls back to English.
export function UIProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <ShortnUIProvider locale={locale === "pt" ? "pt" : "en"}>
      {children}
    </ShortnUIProvider>
  );
}
