"use client";

import { cn } from "@shortn/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Detail-page tabs as sub-routes (23 §2.0); the first tab is the base. */
export function TabNav({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const base = tabs[0]?.href;
  return (
    <nav
      aria-label="Sections"
      className="flex gap-4 overflow-x-auto border-b border-line px-gutter"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === base
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-10 shrink-0 items-center text-small whitespace-nowrap",
              active
                ? "font-medium text-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                : "text-fg-muted hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
