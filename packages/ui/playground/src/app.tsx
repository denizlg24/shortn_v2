import { isTypingTarget, ShortnUIProvider, Toaster } from "@shortn/ui";
import { useEffect, useRef, useState } from "react";
import { PlaygroundProvider, usePlayground, type Section } from "./app-context";
import { CommandPalette } from "./command-palette";
import { GalleryPage } from "./gallery/gallery-page";
import { LinksPage } from "./links/links-page";
import { PlaceholderPage } from "./placeholder-page";
import { MobileDrawer, MobileTabBar } from "./shell/mobile-nav";
import { Sidebar } from "./shell/sidebar";
import { ShortcutsSheet } from "./shortcuts-sheet";

const GO_KEYS: Record<string, Section> = {
  l: "links",
  a: "analytics",
  q: "qr",
  b: "bio",
};

export function App() {
  return (
    <PlaygroundProvider>
      <LocalizedApp />
    </PlaygroundProvider>
  );
}

function LocalizedApp() {
  const { locale } = usePlayground();
  return (
    <ShortnUIProvider locale={locale}>
      <Shell />
    </ShortnUIProvider>
  );
}

function Shell() {
  const { route, navigate, setPaletteOpen, setShortcutsOpen, resolvedTheme } =
    usePlayground();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const pendingGo = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (mod && key === "o") {
        event.preventDefault();
        setWorkspaceMenuOpen(true);
        return;
      }
      if (
        event.defaultPrevented ||
        mod ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="menu"]')
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (Date.now() - pendingGo.current < 1200 && GO_KEYS[key]) {
        event.preventDefault();
        pendingGo.current = 0;
        navigate(GO_KEYS[key]);
        return;
      }
      pendingGo.current = key === "g" ? Date.now() : 0;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate, setPaletteOpen, setShortcutsOpen]);

  return (
    <>
      <div className="flex h-dvh bg-bg text-fg">
        <Sidebar
          workspaceMenuOpen={workspaceMenuOpen}
          onWorkspaceMenuOpenChange={setWorkspaceMenuOpen}
        />
        <main className="flex min-w-0 flex-1 flex-col max-md:pb-14">
          {route.section === "links" ? (
            <LinksPage
              key={route.state}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
          ) : route.section === "gallery" ? (
            <GalleryPage onOpenDrawer={() => setDrawerOpen(true)} />
          ) : (
            <PlaceholderPage onOpenDrawer={() => setDrawerOpen(true)} />
          )}
        </main>
        <MobileTabBar />
      </div>
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <CommandPalette />
      <ShortcutsSheet />
      <Toaster theme={resolvedTheme} />
    </>
  );
}
