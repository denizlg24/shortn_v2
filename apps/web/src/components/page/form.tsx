import { buttonVariants, cn } from "@shortn/ui";
import Link from "next/link";
import type { ReactNode } from "react";

// Labelled field with hint and error, for full-page forms.
export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline gap-2 text-small font-medium"
      >
        {label}
        {optional ? (
          <span className="text-meta font-normal text-fg-subtle">
            {optional}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Bottom of every form page: the primary action and a way back.
export function FormActions({
  submitLabel,
  cancelHref,
  cancelLabel,
  pending,
  tone = "primary",
}: {
  submitLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  pending?: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <div className="mt-8 flex items-center gap-2 border-t border-line pt-5">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonVariants({ variant: tone, size: "lg" })}
      >
        {submitLabel}
      </button>
      {cancelHref && cancelLabel ? (
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          {cancelLabel}
        </Link>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-control border border-line-strong bg-field px-3 text-body text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-signal aria-invalid:border-danger";
