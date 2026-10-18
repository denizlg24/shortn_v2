"use client";

import { Button } from "@shortn/ui";
import { ChevronRight, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { tourAnchor } from "@/lib/tour/anchors";
import { useShell } from "../shell/shell-context";

export interface Crumb {
  label: ReactNode;
  href?: string;
}

// The sticky strip at the top of every page: where you are, and the way back.
export function TopBar({ crumbs }: { crumbs: Crumb[] }) {
  const t = useTranslations("page");
  const nav = useTranslations("nav");
  const { openDrawer } = useShell();
  return (
    <div className="sticky top-0 z-10 flex min-h-11 shrink-0 items-center gap-2 border-b border-line bg-bg px-gutter">
      <Button
        variant="ghost"
        size="icon-md"
        className="-ml-2 md:hidden"
        aria-label={nav("openMenu")}
        onClick={openDrawer}
        {...tourAnchor("help-menu")}
      >
        <Menu aria-hidden />
      </Button>
      <nav aria-label={t("breadcrumb")} className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1 text-small text-fg-muted">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={index} className="flex min-w-0 items-center gap-1">
                {index > 0 ? (
                  <ChevronRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-fg-subtle"
                  />
                ) : null}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="truncate rounded-chip hover:text-fg focus-visible:outline-2 focus-visible:outline-signal"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      last ? "truncate font-medium text-fg" : "truncate"
                    }
                    aria-current={last ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
