import { isTypingTarget } from "@shortn/ui";
import { useEffect, useRef } from "react";
import { allNav, type Section } from "./nav";

const goKeys = new Map(allNav.map((item) => [item.goKey, item.section]));
const sequenceWindowMs = 1200;

export function useShellShortcuts({
  navigate,
  openPalette,
  openShortcuts,
  openWorkspaceMenu,
}: {
  navigate: (section: Section) => void;
  openPalette: () => void;
  openShortcuts: () => void;
  openWorkspaceMenu: () => void;
}) {
  const goPressedAt = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (mod && key === "o") {
        event.preventDefault();
        openWorkspaceMenu();
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
        openShortcuts();
        return;
      }
      const section = goKeys.get(key);
      if (section && Date.now() - goPressedAt.current < sequenceWindowMs) {
        event.preventDefault();
        goPressedAt.current = 0;
        navigate(section);
        return;
      }
      goPressedAt.current = key === "g" ? Date.now() : 0;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate, openPalette, openShortcuts, openWorkspaceMenu]);
}
