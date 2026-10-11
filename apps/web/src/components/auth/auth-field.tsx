"use client";

import { Label } from "@shortn/ui";
import type { ReactNode } from "react";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

interface AuthFieldProps {
  id: string;
  label: ReactNode;
  /** Rendered beside the label, outside it (e.g. a "Forgot password?" link). */
  aside?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  /** Extra element ids describing the control, such as a requirements list. */
  describedBy?: string;
  after?: ReactNode;
  children: (control: FieldControlProps) => ReactNode;
}

export function AuthField({
  id,
  label,
  aside,
  hint,
  error,
  describedBy,
  after,
  children,
}: AuthFieldProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const describedByIds =
    [messageId, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedByIds,
      })}
      {error ? (
        <p id={messageId} className="text-meta text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-meta text-pretty text-fg-muted">
          {hint}
        </p>
      ) : null}
      {after}
    </div>
  );
}
