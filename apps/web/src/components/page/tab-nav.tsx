"use client";

import { cn } from "@shortn/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Tab {
  label: string;
  href: string;
  // Matches sub-pages too (e.g. /utm/new under the UTM tab).
  match?: "exact" | "prefix";
}

// Detail pages split into one URL per tab (17: owner decision).
export function TabNav({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="-mb-px overflow-x-auto [scrollbar-width:none]"
    >
      <ul className="flex gap-5">
        {tabs.map((tab) => {
          const current =
            tab.match === "prefix"
              ? pathname === tab.href || pathname.startsWith(`${tab.href}/`)
              : pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center border-b-2 text-small whitespace-nowrap transition-colors",
                  current
                    ? "border-fg font-medium text-fg"
                    : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
