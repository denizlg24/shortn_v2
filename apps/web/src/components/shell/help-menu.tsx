"use client";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shortn/ui";
import {
  ArrowUpRight,
  CircleQuestionMark,
  Keyboard,
  LifeBuoy,
  MessageSquare,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useChangelogSeen } from "@/lib/changelog/use-changelog-seen";
import { tourAnchor } from "@/lib/tour/anchors";
import { GuideMenuItems, UnseenDot } from "./guide-menu-items";
import { useShell } from "./shell-context";

/**
 * Help, What's new and the tour. `rail` sits in the sidebar and collapses to
 * its icon between 768 and 1199px; `full` sits in the mobile drawer, where
 * keyboard shortcuts don't apply.
 */
export function HelpMenu({ layout }: { layout: "rail" | "full" }) {
  const t = useTranslations("shell.help");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { openShortcuts, workspace, closeDrawer } = useShell();
  const { unseen } = useChangelogSeen();
  const rail = layout === "rail";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unseen ? t("unseen") : t("label")}
          {...(rail ? tourAnchor("help-menu") : {})}
          className={cn(
            "group flex w-full cursor-pointer items-center rounded-control text-fg-muted hover:bg-bg-muted hover:text-fg aria-expanded:bg-bg-muted",
            rail
              ? "h-8 gap-2.5 px-2 text-small max-xl:size-8 max-xl:justify-center max-xl:px-0"
              : "h-10 gap-3 px-2.5 text-body",
          )}
        >
          <span className="relative flex shrink-0">
            <CircleQuestionMark aria-hidden className="size-4 text-fg-subtle" />
            {unseen ? (
              <UnseenDot
                className={cn(
                  "absolute -top-1 -right-1 ring-2 group-hover:ring-bg-muted group-aria-expanded:ring-bg-muted",
                  rail ? "ring-bg-subtle" : "ring-bg",
                )}
              />
            ) : null}
          </span>
          <span className={cn(rail && "max-xl:sr-only")}>{t("label")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuItem
          icon={<LifeBuoy aria-hidden />}
          onSelect={() =>
            window.open(
              `https://shortn.at/${locale}/help`,
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          <span className="inline-flex items-center gap-1">
            {t("center")}
            <ArrowUpRight aria-hidden className="size-3.5 text-fg-subtle" />
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<MessageSquare aria-hidden />}
          onSelect={() => {
            closeDrawer();
            router.push(
              `/${workspace.slug}/feedback?from=${encodeURIComponent(pathname)}`,
            );
          }}
        >
          {t("feedback")}
        </DropdownMenuItem>
        {rail ? (
          <DropdownMenuItem
            icon={<Keyboard aria-hidden />}
            shortcut="?"
            onSelect={openShortcuts}
          >
            {t("shortcuts")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <GuideMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
