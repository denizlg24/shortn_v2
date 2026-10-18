"use client";

import { cn, Tooltip } from "@shortn/ui";
import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Spoken name when the visible label is an abbreviation. */
  ariaLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const segmentFrame =
  "inline-flex h-8 shrink-0 items-center gap-px rounded-control border border-line-strong bg-field p-0.5";

export const segmentButton = cn(
  "inline-flex h-6 cursor-pointer items-center gap-1 rounded-chip px-2 text-small whitespace-nowrap text-fg-muted",
  "hover:text-fg aria-pressed:bg-bg-muted aria-pressed:font-medium aria-pressed:text-fg aria-expanded:bg-bg-muted aria-expanded:text-fg",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:text-fg-muted",
);

/** A row of toggle buttons for one exclusive choice, e.g. the chart interval. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
  children,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  className?: string | undefined;
  /** Extra trailing segment, e.g. a popover trigger. */
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(segmentFrame, className)}
    >
      {options.map((option) => {
        const button = (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            aria-disabled={option.disabled || undefined}
            aria-label={option.ariaLabel}
            onClick={() => {
              if (!option.disabled && option.value !== value)
                onValueChange(option.value);
            }}
            className={segmentButton}
          >
            {option.label}
          </button>
        );
        return option.disabled && option.disabledReason ? (
          <Tooltip key={option.value} content={option.disabledReason}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
      {children}
    </div>
  );
}
