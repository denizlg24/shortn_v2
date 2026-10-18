"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { CommandPalette } from "./command-palette";
import { ImpersonationBanner } from "./impersonation-banner";
import { MobileDrawer, MobileTabBar } from "./mobile-nav";
import { sectionFromPath, sectionHref, type Section } from "./nav";
import { ShellContext, type ShellValue } from "./shell-context";
import { ShortcutsSheet } from "./shortcuts-sheet";
import { Sidebar } from "./sidebar";
import type { ShellUser, UsageItem, WorkspaceSummary } from "./types";
import { useShellShortcuts } from "./use-shell-shortcuts";

const noUsage: UsageItem[] = [];
const sidebarQuery = "(min-width: 768px)";

export interface ShellProps {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: ShellUser;
  impersonating: boolean;
  usage?: UsageItem[];
  children: ReactNode;
}

export function Shell({
  workspace,
  workspaces,
  user,
  impersonating,
  usage = noUsage,
  children,
}: ShellProps) {
  const t = useTranslations("shell");
  const router = useRouter();
  const activeSection = sectionFromPath(usePathname());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const navigate = useCallback(
    (section: Section) => router.push(sectionHref(workspace.slug, section)),
    [router, workspace.slug],
  );
  const switchWorkspace = useCallback(
    (slug: string) => router.push(sectionHref(slug, "links")),
    [router],
  );
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  // The switcher lives in the sidebar, which is hidden below 768px.
  const openWorkspaceMenu = useCallback(() => {
    if (window.matchMedia(sidebarQuery).matches) setWorkspaceMenuOpen(true);
    else setDrawerOpen(true);
  }, []);

  const createLink = useCallback(
    () => router.push(`/${workspace.slug}/links/new`),
    [router, workspace.slug],
  );
  useShellShortcuts({
    navigate,
    openPalette,
    openShortcuts,
    openWorkspaceMenu,
    createLink,
  });

  const value = useMemo<ShellValue>(
    () => ({
      workspace,
      workspaces,
      user,
      usage,
      activeSection,
      navigate,
      switchWorkspace,
      openDrawer,
      openShortcuts,
    }),
    [
      workspace,
      workspaces,
      user,
      usage,
      activeSection,
      navigate,
      switchWorkspace,
      openDrawer,
      openShortcuts,
    ],
  );

  return (
    <ShellContext.Provider value={value}>
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-bg px-3 py-2 text-small font-medium shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>
      {/* `relative` keeps absolutely positioned descendants (sr-only labels,
          hidden inputs) inside the scroll container; otherwise they resolve
          against the viewport and give the page a second, empty scrollbar. */}
      <div className="relative flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        {impersonating ? <ImpersonationBanner /> : null}
        <div className="flex min-h-0 flex-1">
          <Sidebar
            workspaceMenuOpen={workspaceMenuOpen}
            onWorkspaceMenuOpenChange={setWorkspaceMenuOpen}
          />
          <main
            id="main"
            tabIndex={-1}
            className="relative flex min-w-0 flex-1 flex-col overflow-y-auto outline-none max-md:pb-14"
          >
            {children}
          </main>
        </div>
        <MobileTabBar />
      </div>
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </ShellContext.Provider>
  );
}
