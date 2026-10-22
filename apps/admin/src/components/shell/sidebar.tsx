"use client";

import { cn, ShortnMark } from "@shortn/ui";
import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActive, nav } from "./nav";

export interface SidebarProps {
  email: string;
  role: "admin" | "superadmin";
}

export function Sidebar({ email, role }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside
      aria-label="Admin"
      className="flex shrink-0 flex-col border-line bg-bg-subtle max-md:border-b md:h-full md:w-sidebar md:border-r"
    >
      <div className="flex h-12 items-center gap-2 px-4 md:h-page-header">
        <ShortnMark className="size-5" />
        <span className="text-small font-semibold">Shortn Admin</span>
        <button
          type="button"
          className="ml-auto rounded-control p-1.5 text-fg-muted hover:bg-bg-muted hover:text-fg md:hidden"
          aria-expanded={open}
          aria-controls="admin-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      <nav
        id="admin-nav"
        aria-label="Sections"
        className={cn(
          "flex-col gap-3 px-3 pb-3 md:flex md:flex-1 md:overflow-y-auto",
          open ? "flex" : "hidden",
        )}
      >
        {nav.map((group, index) => (
          <ul key={index} className="flex flex-col gap-px">
            {group.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-control px-2 text-small",
                      active
                        ? "bg-bg-muted font-medium text-fg"
                        : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0",
                        active
                          ? "text-primary"
                          : "text-fg-subtle group-hover:text-fg-muted",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
        <div className="mt-auto flex items-center gap-2 border-t border-line px-2 pt-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-medium" title={email}>
              {email}
            </p>
            <p className="text-meta text-fg-muted">{role}</p>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-control p-1.5 text-fg-muted hover:bg-bg-muted hover:text-fg"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
