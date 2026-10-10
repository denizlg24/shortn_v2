import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse-soft rounded-chip bg-bg-muted",
        className,
      )}
      {...props}
    />
  );
}
