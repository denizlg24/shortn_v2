"use client";

import { cn } from "@shortn/ui";
import { useId, type ReactNode } from "react";
import { OptionGroup, type Option } from "./option-group";

/** One group of controls in an editor column, split from the next by a hairline. */
export function EditorSection({
  title,
  description,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** End of the heading row, e.g. a plan note or a section action. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 border-b border-line px-gutter py-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
          <h2 id={headingId} className="text-body font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="text-small text-pretty text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A labelled exclusive choice, laid out like the other fields. */
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
        <p className="text-meta text-pretty text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
