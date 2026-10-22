import {
  ChartColumn,
  Link2,
  Megaphone,
  QrCode,
  Settings,
  SquareUser,
  Tags,
  type LucideIcon,
} from "lucide-react";

export const sections = [
  "links",
  "analytics",
  "qr",
  "bio",
  "campaigns",
  "tags",
  "settings",
] as const;
export type Section = (typeof sections)[number];

export interface NavItem {
  section: Section;
  icon: LucideIcon;
  /** Second key of the `G` then key navigation sequence. */
  goKey: string;
}

export const primaryNav: NavItem[] = [
  { section: "links", icon: Link2, goKey: "l" },
  { section: "analytics", icon: ChartColumn, goKey: "a" },
  { section: "qr", icon: QrCode, goKey: "q" },
  { section: "bio", icon: SquareUser, goKey: "b" },
  { section: "campaigns", icon: Megaphone, goKey: "c" },
  { section: "tags", icon: Tags, goKey: "t" },
];

export const secondaryNav: NavItem[] = [
  { section: "settings", icon: Settings, goKey: "s" },
];

export const allNav = [...primaryNav, ...secondaryNav];

/** 12 §Responsive: the bottom bar holds the four main sections. */
export const mobileTabs = primaryNav.slice(0, 4);

export const sectionHref = (slug: string, section: Section) =>
  `/${slug}/${section}` as const;

export function sectionFromPath(pathname: string): Section | null {
  const segment = pathname.split("/")[2];
  return sections.find((section) => section === segment) ?? null;
}
