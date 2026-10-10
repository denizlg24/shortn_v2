import type { LinkRow } from "@shortn/ui";

/** What the Links page exposes to app-level surfaces (⌘K palette, global shortcuts). */
export interface LinksApi {
  links: LinkRow[];
  activeLink: LinkRow | null;
  canEdit: boolean;
  openComposer: (url?: string) => void;
  createFromClipboard: () => void;
  focusSearch: () => void;
  openLink: (link: LinkRow, tab: "overview" | "edit") => void;
  copyLink: (link: LinkRow) => void;
}

let current: LinksApi | null = null;

export const linksApiRegistry = {
  set(api: LinksApi | null) {
    current = api;
  },
  get(): LinksApi | null {
    return current;
  },
};
