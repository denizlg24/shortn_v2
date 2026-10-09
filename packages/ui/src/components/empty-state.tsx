import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <p
          className={cn(
            "text-body font-medium text-pretty",
            tone === "danger" ? "text-danger" : "text-fg",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="text-small text-pretty text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
