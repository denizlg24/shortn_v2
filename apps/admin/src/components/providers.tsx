"use client";

import { ShortnUIProvider } from "@shortn/ui";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <ShortnUIProvider locale="en">{children}</ShortnUIProvider>;
}
