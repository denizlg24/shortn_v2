"use client";

import { cn } from "@shortn/ui";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
  /** A picture of the choice above its label, e.g. a rendered QR style. */
  visual?: ReactNode;
}

const nextKeys: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * One exclusive choice in a form, with native radio keyboard behaviour:
 * Tab reaches the checked option, arrows move and select.
 */
export function OptionGroup<T extends string>({
  labelledBy,
  options,
  value,
  onValueChange,
  disabled,
  className,
}: {
  labelledBy: string;
  options: Option<T>[];
  /** May be a stored value the editor doesn't offer; then nothing is checked. */
  value: string | undefined;
  onValueChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((option) => option.value === value);
  const tabStop = checkedIndex >= 0 ? checkedIndex : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const step = nextKeys[event.key];
    if (!step || disabled) return;
    event.preventDefault();
    const next = (at + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onValueChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((option, at) => {
        const checked = at === checkedIndex;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[at] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={at === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, at)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line-strong bg-field text-small text-fg-muted",
              "transition-[border-color,color] duration-(--motion-fast) hover:border-fg-subtle/60 hover:text-fg",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal",
              "aria-checked:border-signal aria-checked:bg-signal-wash aria-checked:font-medium aria-checked:text-fg",
              "disabled:cursor-not-allowed disabled:opacity-50",
              option.visual ? "flex-col px-2 pt-2 pb-1.5" : "h-8 px-2.5",
            )}
          >
            {option.visual}
            <span className={cn(option.visual && "text-meta")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A labelled exclusive choice, laid out like the other form fields. */
export function ChoiceField<T extends string>({
  label,
  hint,
  options,
  value,
  onValueChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  options: Option<T>[];
  value: string | undefined;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-small font-medium">
        {label}
      </span>
      <OptionGroup
        labelledBy={labelId}
        options={options}
        value={value}
        onValueChange={onValueChange}
        {...(disabled === undefined ? {} : { disabled })}
      />
      {hint ? (
        <p className="text-small text-pretty text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
