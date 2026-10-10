"use client";

import { createContext, useContext } from "react";
import type { Section } from "./nav";
import type { ShellUser, UsageItem, WorkspaceSummary } from "./types";

export interface ShellValue {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  user: ShellUser;
  usage: UsageItem[];
  activeSection: Section | null;
  navigate: (section: Section) => void;
  switchWorkspace: (slug: string) => void;
  openDrawer: () => void;
  openShortcuts: () => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside <Shell>");
  return value;
}
