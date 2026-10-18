"use client";

import { cn, Tooltip } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AccountMenu } from "./account-menu";
import { HelpMenu } from "./help-menu";
import { primaryNav, secondaryNav, sectionHref, type NavItem } from "./nav";
import { useShell } from "./shell-context";
import { UsageSummary } from "./usage-summary";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function Sidebar({
  workspaceMenuOpen,
  onWorkspaceMenuOpenChange,
}: {
  workspaceMenuOpen: boolean;
  onWorkspaceMenuOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const { usage } = useShell();
  return (
    <aside
      aria-label={t("main")}
      className="hidden h-full w-rail shrink-0 flex-col border-r border-line bg-bg-subtle md:flex xl:w-sidebar"
    >
      <div className="px-2.5 pt-2.5 pb-2 xl:px-3">
        <WorkspaceSwitcher
          layout="rail"
          open={workspaceMenuOpen}
          onOpenChange={onWorkspaceMenuOpenChange}
        />
      </div>
      <nav aria-label={t("main")} className="flex flex-col px-2 xl:px-3">
        <ul className="flex flex-col gap-px">
          {primaryNav.map((item) => (
            <li key={item.section}>
              <NavLink item={item} />
            </li>
          ))}
        </ul>
        <div aria-hidden className="mx-2 my-3 h-px bg-line" />
        <ul className="flex flex-col gap-px">
          {secondaryNav.map((item) => (
            <li key={item.section}>
              <NavLink item={item} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-2 pb-3 xl:px-3">
        <UsageSummary items={usage} className="hidden px-2 xl:flex" />
        <div className="flex flex-col gap-px border-t border-line pt-2 max-xl:items-center">
          <HelpMenu layout="rail" />
          <AccountMenu layout="rail" />
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item }: { item: NavItem }) {
  const t = useTranslations("nav");
  const { workspace, activeSection } = useShell();
  const active = activeSection === item.section;
  const label = t(item.section);
  const Icon = item.icon;
  return (
    <Tooltip
      content={label}
      side="right"
      shortcut={["g", item.goKey]}
      shortcutSequence
      className="xl:hidden"
    >
      <Link
        href={sectionHref(workspace.slug, item.section)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-8 items-center gap-2.5 rounded-control px-2 text-small max-xl:justify-center max-xl:px-0",
          active
            ? "bg-bg-muted font-medium text-fg"
            : "text-fg-muted hover:bg-bg-muted hover:text-fg",
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            active
              ? "text-primary"
              : "text-fg-subtle group-hover:text-fg-muted",
          )}
        />
        <span className="truncate max-xl:sr-only">{label}</span>
      </Link>
    </Tooltip>
  );
}
