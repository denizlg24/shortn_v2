import type { ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";

export interface BarListItem {
  id: string;
  label: string;
  value: number;
  icon?: ReactNode;
}

export interface BarListProps {
  items: BarListItem[];
  /** Accessible name for the list, e.g. "Top countries". */
  label: string;
  onSelect?: (item: BarListItem) => void;
  className?: string;
}

export function BarList({ items, label, onSelect, className }: BarListProps) {
  const { intlLocale } = useUILocale();
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul aria-label={label} className={cn("flex flex-col", className)}>
      {items.map((item) => {
        const row = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-1 left-0 rounded-chip bg-signal-wash"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
            <span className="relative flex min-w-0 flex-1 items-center gap-2 pl-2">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="relative shrink-0 pr-1 font-mono text-fg-muted tabular-nums">
              {formatNumber(item.value, intlLocale)}
            </span>
          </>
        );
        return (
          <li key={item.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="relative flex h-8 w-full cursor-pointer items-center gap-3 rounded-chip text-left text-small hover:bg-bg-subtle"
              >
                {row}
              </button>
            ) : (
              <div className="relative flex h-8 items-center gap-3 text-small">
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
