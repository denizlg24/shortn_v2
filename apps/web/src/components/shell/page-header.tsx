"use client";

import { Button, cn } from "@shortn/ui";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { tourAnchor } from "@/lib/tour/anchors";
import { useShell } from "./shell-context";

/** 12 §App shell: title + count · search · filters · primary action, sticky. */
export function PageHeader({
  title,
  count,
  className,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("nav");
  const { openDrawer } = useShell();
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex min-h-page-header shrink-0 items-center gap-3 border-b border-line bg-bg px-gutter",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-md"
        className="-ml-2 md:hidden"
        aria-label={t("openMenu")}
        onClick={openDrawer}
        {...tourAnchor("help-menu")}
      >
        <Menu aria-hidden />
      </Button>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="min-w-0 truncate text-title font-semibold tracking-[-0.015em]">
          {title}
        </h1>
        {count === undefined ? null : (
          <span
            className="font-mono text-small whitespace-nowrap text-fg-muted tabular-nums"
            aria-live="polite"
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </header>
  );
}
