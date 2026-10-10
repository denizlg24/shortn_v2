import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { formatPercent } from "../lib/format";

export interface Stat {
  label: string;
  value: ReactNode;
  /** Relative change vs the previous period, e.g. 0.124 for +12.4%. */
  delta?: number;
  detail?: ReactNode;
}

export interface StatStripProps {
  stats: Stat[];
  className?: string;
}

export function StatStrip({ stats, className }: StatStripProps) {
  return (
    <dl
      className={cn(
        "grid auto-cols-fr grid-flow-col divide-x divide-line max-sm:grid-flow-row max-sm:grid-cols-2 max-sm:divide-x-0",
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-0 flex-col gap-1 px-5 py-1 first:pl-0 max-sm:px-0 max-sm:py-2.5"
        >
          <dt className="truncate text-meta text-fg-muted">{stat.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate text-title font-semibold tracking-[-0.015em] tabular-nums">
              {stat.value}
            </span>
            {stat.delta === undefined ? null : <Delta value={stat.delta} />}
          </dd>
          {stat.detail ? (
            <dd className="truncate text-meta text-fg-subtle">{stat.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function Delta({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const { t, intlLocale } = useUILocale();
  const magnitude = formatPercent(Math.abs(value), intlLocale);
  const direction =
    Math.abs(value) < 0.0005 ? "flat" : value > 0 ? "up" : "down";
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : ArrowRight;
  const spoken =
    direction === "flat"
      ? t.deltaFlat
      : `${direction === "up" ? t.deltaUp(magnitude) : t.deltaDown(magnitude)} ${t.comparedToPrevious}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-meta font-medium tabular-nums",
        direction === "up" && "text-success",
        direction === "down" && "text-danger",
        direction === "flat" && "text-fg-muted",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span aria-hidden>{direction === "flat" ? "0%" : magnitude}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
