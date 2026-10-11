"use client";

import { cn } from "@shortn/ui";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsGroups, settingsHref, settingsItemFromPath } from "./tabs";

/** Left sub-nav on desktop, a scrolling strip below 768px. */
export function SettingsNav({ slug }: { slug: string }) {
  const t = useTranslations("settings.nav");
  const active = settingsItemFromPath(usePathname());
  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "shrink-0",
        "max-md:overflow-x-auto max-md:border-b max-md:border-line max-md:px-gutter max-md:[scrollbar-width:none]",
        "md:w-56 md:border-r md:border-line",
      )}
    >
      <div className="flex gap-5 md:sticky md:top-0 md:flex-col md:gap-6 md:px-3 md:py-6">
        {settingsGroups.map((group) => (
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
              {group.items.map((item) => {
                const current = active === item;
                return (
                  <li key={item}>
                    <Link
                      href={settingsHref(slug, item)}
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
                      {t(item)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
