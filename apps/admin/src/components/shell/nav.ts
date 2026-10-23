import {
  Building2,
  CreditCard,
  Flag,
  Gauge,
  Globe,
  Inbox,
  Link2,
  ListChecks,
  MessageSquare,
  ScrollText,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const nav: NavItem[][] = [
  [{ href: "/", label: "Overview", icon: Gauge }],
  [
    { href: "/workspaces", label: "Workspaces", icon: Building2 },
    { href: "/users", label: "Users", icon: Users },
    { href: "/links", label: "Links", icon: Link2 },
    { href: "/reports", label: "Reports", icon: Flag },
  ],
  [
    { href: "/domains", label: "Domains", icon: Globe },
    { href: "/webhooks", label: "Webhooks", icon: Webhook },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/jobs", label: "Jobs", icon: ListChecks },
  ],
  [
    { href: "/contacts", label: "Contacts", icon: Inbox },
    { href: "/feedback", label: "Feedback", icon: MessageSquare },
    { href: "/audit", label: "Audit", icon: ScrollText },
  ],
];

export const isActive = (pathname: string, href: string) =>
  href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
