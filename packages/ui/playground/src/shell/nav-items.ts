import {
  ChartColumn,
  Globe,
  Link2,
  Megaphone,
  QrCode,
  Settings,
  SquareUser,
  type LucideIcon,
} from "lucide-react";
import type { Section } from "../app-context";
import type { Copy } from "../i18n";

export interface NavItem {
  section: Section;
  icon: LucideIcon;
  label: (copy: Copy) => string;
  goKey?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    section: "links",
    icon: Link2,
    label: (copy) => copy.nav.links,
    goKey: "l",
  },
  {
    section: "analytics",
    icon: ChartColumn,
    label: (copy) => copy.nav.analytics,
    goKey: "a",
  },
  { section: "qr", icon: QrCode, label: (copy) => copy.nav.qr, goKey: "q" },
  {
    section: "bio",
    icon: SquareUser,
    label: (copy) => copy.nav.bio,
    goKey: "b",
  },
  {
    section: "campaigns",
    icon: Megaphone,
    label: (copy) => copy.nav.campaigns,
  },
];

export const SECONDARY_NAV: NavItem[] = [
  { section: "domains", icon: Globe, label: (copy) => copy.nav.domains },
  { section: "settings", icon: Settings, label: (copy) => copy.nav.settings },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
