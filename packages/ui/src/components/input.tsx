import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export const fieldFrame = [
  "rounded-control border border-line-strong bg-field text-fg",
  "transition-[border-color,box-shadow] duration-(--motion-fast)",
  "hover:border-fg-subtle/50",
  "focus-within:border-signal focus-within:ring-1 focus-within:ring-signal focus-within:hover:border-signal",
  "has-aria-invalid:border-danger has-aria-invalid:focus-within:ring-danger has-aria-invalid:hover:border-danger",
  "has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:border-line-strong",
];

const sizes = {
  sm: "h-7 text-small",
  md: "h-8 text-small",
  lg: "h-9 text-body",
} as const;

export interface InputProps extends Omit<ComponentProps<"input">, "size"> {
  size?: keyof typeof sizes;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Applied to the bordered frame; `className` targets the native input. */
  frameClassName?: string;
}

export function Input({
  size = "md",
  leading,
  trailing,
  frameClassName,
  className,
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 px-2.5 py-1",
        fieldFrame,
        sizes[size],
        frameClassName,
      )}
    >
      {leading ? (
        <span className="flex shrink-0 items-center text-fg-subtle [&_svg]:size-4">
          {leading}
        </span>
      ) : null}
      <input
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed",
          "[&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {trailing ? (
        <span className="flex shrink-0 items-center gap-1 text-fg-subtle">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "block min-h-20 w-full resize-y px-2.5 py-2 text-small outline-none placeholder:text-fg-subtle",
        fieldFrame,
        "focus:border-signal focus:ring-1 focus:ring-signal aria-invalid:border-danger aria-invalid:focus:ring-danger disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-small font-medium text-fg", className)}
      {...props}
    />
  );
}

export interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-meta text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-meta text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
