import type { Workspace } from "@shortn/core";

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  plan: Workspace["plan"];
}

export interface ShellUser {
  name: string;
  email: string;
  image: string | null;
}

export interface UsageItem {
  label: string;
  used: number;
  /** `null` means the plan has no cap for this metric. */
  limit: number | null;
}
