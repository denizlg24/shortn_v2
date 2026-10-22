import { cn } from "@shortn/ui";
import type { ReactNode } from "react";

export type Tone = "neutral" | "success" | "warning" | "danger";

const dot: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** An 8px status dot and its label; colour describes state only. */
export function Status({
  tone,
  children,
  title,
}: {
  tone: Tone;
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 text-small"
      title={title}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", dot[tone])}
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** A label chip (not a control). */
export function Chip({
  children,
  title,
}: {
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <span
      className="inline-block max-w-32 truncate rounded-chip bg-fg/6 px-1.5 py-0.5 align-middle text-meta text-fg-muted"
      title={title}
    >
      {children}
    </span>
  );
}

export function Mono({
  children,
  title,
}: {
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <span className="font-mono text-small tabular-nums" title={title}>
      {children}
    </span>
  );
}
