"use client";

import { cn, UsageMeter } from "@shortn/ui";
import { useLocale, useTranslations } from "next-intl";
import type { UsageItem } from "./types";

export function UsageSummary({
  items,
  className,
}: {
  items: UsageItem[];
  className?: string;
}) {
  const t = useTranslations("shell.usage");
  const locale = useLocale();
  if (items.length === 0) return null;
  return (
    <section
      aria-label={t("label")}
      className={cn("flex flex-col gap-3", className)}
    >
      {items.map((item) =>
        item.limit === null ? (
          <div
            key={item.label}
            className="flex min-w-0 items-baseline justify-between gap-2 text-meta"
          >
            <span className="min-w-0 truncate text-fg-muted">{item.label}</span>
            <span className="shrink-0 font-mono whitespace-nowrap text-fg tabular-nums">
              {item.used.toLocaleString(locale)}
              <span className="text-fg-subtle"> · {t("unlimited")}</span>
            </span>
          </div>
        ) : (
          <UsageMeter
            key={item.label}
            label={item.label}
            used={item.used}
            limit={item.limit}
            unit=""
          />
        ),
      )}
    </section>
  );
}
