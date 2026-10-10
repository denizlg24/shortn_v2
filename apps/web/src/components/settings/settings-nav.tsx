"use client";

import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  personalTabs,
  settingsHref,
  settingsTabFromPath,
  workspaceTabs,
} from "./tabs";

const groups = [
  { id: "workspace", tabs: workspaceTabs },
  { id: "personal", tabs: personalTabs },
] as const;

/** 12 §Surfaces: left sub-nav on desktop, an underline strip below 768px. */
export function SettingsNav({ slug }: { slug: string }) {
  const t = useTranslations("settings.nav");
  const active = settingsTabFromPath(usePathname());
  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "shrink-0",
        "max-md:overflow-x-auto max-md:border-b max-md:border-line max-md:px-gutter max-md:[scrollbar-width:none]",
        "md:sticky md:top-page-header md:w-52 md:self-start md:py-8 md:pl-4",
      )}
    >
      <div className="flex gap-5 md:flex-col md:gap-5">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-1">
            <p
              id={`settings-nav-${group.id}`}
              className="px-2 text-meta font-medium text-fg-subtle max-md:sr-only"
            >
              {t(group.id)}
            </p>
            <ul
              aria-labelledby={`settings-nav-${group.id}`}
              className="flex gap-5 md:flex-col md:gap-px"
            >
              {group.tabs.map((tab) => (
                <li key={tab}>
                  <SettingsNavLink
                    href={settingsHref(slug, tab)}
                    label={t(tab)}
                    current={active === tab}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function SettingsNavLink({
  href,
  label,
  current,
}: {
  href: ReturnType<typeof settingsHref>;
  label: string;
  current: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex items-center text-small whitespace-nowrap",
        "max-md:relative max-md:h-10 max-md:after:absolute max-md:after:inset-x-0 max-md:after:bottom-0 max-md:after:h-0.5 max-md:after:rounded-full max-md:after:content-['']",
        "md:h-8 md:rounded-control md:px-2",
        current
          ? "font-medium text-fg max-md:after:bg-primary md:bg-bg-muted"
          : "text-fg-muted hover:text-fg md:hover:bg-bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
