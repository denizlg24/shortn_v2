"use client";

import { Button } from "@shortn/ui";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useShell } from "./shell-context";

/** 12 §App shell: title + count · search · filters · primary action, sticky. */
export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const t = useTranslations("nav");
  const { openDrawer } = useShell();
  return (
    <header className="sticky top-0 z-10 flex min-h-page-header shrink-0 items-center gap-3 border-b border-line bg-bg px-gutter">
      <Button
        variant="ghost"
        size="icon-md"
        className="-ml-2 md:hidden"
        aria-label={t("openMenu")}
        onClick={openDrawer}
      >
        <Menu aria-hidden />
      </Button>
      <h1 className="text-title font-semibold tracking-[-0.015em]">{title}</h1>
      {children}
    </header>
  );
}
