export const workspaceTabs = ["general", "members", "billing"] as const;
export const personalTabs = ["account"] as const;
export type SettingsTab =
  (typeof workspaceTabs)[number] | (typeof personalTabs)[number];

export function settingsHref(slug: string, tab: SettingsTab) {
  return tab === "general"
    ? (`/${slug}/settings` as const)
    : (`/${slug}/settings/${tab}` as const);
}

export function settingsTabFromPath(pathname: string): SettingsTab {
  const segment = pathname.split("/")[3];
  return (
    [...workspaceTabs, ...personalTabs].find((tab) => tab === segment) ??
    "general"
  );
}
