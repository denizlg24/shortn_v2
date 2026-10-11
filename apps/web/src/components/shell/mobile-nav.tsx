"use client";

import {
  cn,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { allNav, mobileTabs, sectionHref } from "./nav";
import { useShell } from "./shell-context";
import { UsageSummary } from "./usage-summary";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function MobileTabBar() {
  const t = useTranslations("nav");
  const { workspace, activeSection } = useShell();
  return (
    <nav
      aria-label={t("main")}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {mobileTabs.map((item) => {
        const Icon = item.icon;
        const active = activeSection === item.section;
        return (
          <Link
            key={item.section}
            href={sectionHref(workspace.slug, item.section)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium",
              active ? "text-fg" : "text-fg-muted",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "size-5",
                active ? "text-primary" : "text-fg-subtle",
              )}
              strokeWidth={active ? 2.25 : 1.75}
            />
            <span className="max-w-full truncate px-1">{t(item.section)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const { workspace, activeSection, usage } = useShell();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <div className="-my-1 -ml-1.5">
            <WorkspaceSwitcher layout="full" />
          </div>
        </SheetHeader>
        <SheetBody className="flex flex-col px-3">
          <nav aria-label={t("main")}>
            <ul className="flex flex-col gap-px">
              {allNav.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.section;
                return (
                  <li key={item.section}>
                    <Link
                      href={sectionHref(workspace.slug, item.section)}
                      aria-current={active ? "page" : undefined}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-control px-2.5 text-body",
                        active
                          ? "bg-bg-muted font-medium text-fg"
                          : "text-fg-muted",
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-4",
                          active ? "text-primary" : "text-fg-subtle",
                        )}
                      />
                      {t(item.section)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-4 border-t border-line pt-4">
            <UsageSummary items={usage} className="px-2.5" />
            <AccountMenu layout="full" />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
