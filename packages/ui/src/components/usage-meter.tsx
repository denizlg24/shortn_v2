import type { ReactNode } from "react";
import { useUILocale } from "../i18n/provider";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";

export interface UsageMeterProps {
  label: string;
  used: number;
  limit: number;
  /** Spoken unit for the meter value, e.g. "clicks". */
  unit: string;
  detail?: ReactNode;
  /** Fraction at which the meter switches to the warning state. */
  warnAt?: number;
  className?: string;
}

export function UsageMeter({
  label,
  used,
  limit,
  unit,
  detail,
  warnAt = 0.8,
  className,
}: UsageMeterProps) {
  const { t, intlLocale } = useUILocale();
  const ratio = limit > 0 ? used / limit : 1;
  const state = ratio > 1 ? "over" : ratio >= warnAt ? "near" : "ok";
  const usedText = formatNumber(used, intlLocale);
  const limitText = formatNumber(limit, intlLocale);
  const status =
    state === "over"
      ? t.usageOver(formatNumber(used - limit, intlLocale))
      : state === "near"
        ? t.usageRemaining(formatNumber(limit - used, intlLocale))
        : null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-meta">
        <span className="min-w-0 truncate text-fg-muted">{label}</span>
        {status ? (
          <span
            className={cn(
              "shrink-0 font-medium whitespace-nowrap",
              state === "over" ? "text-danger" : "text-warning",
            )}
          >
            {status}
          </span>
        ) : null}
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${t.usageOf(usedText, limitText)} ${unit}`}
        className="h-1 overflow-hidden rounded-full bg-fg/8"
      >
        <div
          className={cn(
            "h-full rounded-full",
            state === "ok" && "bg-fg-muted",
            state === "near" && "bg-warning",
            state === "over" && "bg-danger",
          )}
          style={{ width: `${Math.min(1, ratio) * 100}%` }}
        />
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-meta">
        <span
          className="font-mono whitespace-nowrap text-fg tabular-nums"
          aria-hidden
        >
          {usedText}
          <span className="text-fg-subtle"> / </span>
          {limitText}
        </span>
        {detail ? <span className="text-fg-subtle">{detail}</span> : null}
      </div>
    </div>
  );
}
